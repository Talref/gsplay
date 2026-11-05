const { TextDecoder } = require('node:util');
const { AppError } = require('../http/errors');

const MAX_IMPORT_GAMES = 5_000;

function invalidFile(message) {
  throw new AppError(400, 'invalid_import_file', message);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n') {
      row.push(value.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      value = '';
    } else value += character;
  }
  if (quoted) invalidFile('CSV contains an unterminated quoted value');
  if (value || row.length) {
    row.push(value.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function validateGames(games) {
  if (!Array.isArray(games) || !games.length || games.length > MAX_IMPORT_GAMES)
    invalidFile(`Import must contain between 1 and ${MAX_IMPORT_GAMES} games`);
  return games.map((game, index) => {
    if (!game || typeof game !== 'object' || Array.isArray(game))
      invalidFile(`Game ${index + 1} must be an object`);
    const providerGameId =
      typeof game.providerGameId === 'string' ? game.providerGameId.trim() : '';
    const providerTitle = typeof game.providerTitle === 'string' ? game.providerTitle.trim() : '';
    if (
      !providerGameId ||
      providerGameId.length > 256 ||
      !providerTitle ||
      providerTitle.length > 512
    )
      invalidFile(
        `Game ${index + 1} requires providerGameId and providerTitle within supported lengths`
      );
    return { providerGameId, providerTitle };
  });
}

function legacyProviderGames(parsed, provider) {
  const records = provider === 'gog' ? parsed?.games : parsed?.library;
  if (!Array.isArray(records)) {
    const expected = provider === 'gog' ? '{ "games": [...] }' : '{ "library": [...] }';
    invalidFile(
      `${provider.toUpperCase()} JSON must use ${expected} with app_name and title fields`
    );
  }
  return records.map((game) => ({
    providerGameId:
      typeof game?.app_name === 'string' || Number.isFinite(game?.app_name)
        ? String(game.app_name)
        : '',
    providerTitle: game?.title
  }));
}

function isNeutralGameArray(games) {
  return (
    Array.isArray(games) &&
    games.every(
      (game) =>
        game &&
        typeof game === 'object' &&
        !Array.isArray(game) &&
        Object.prototype.hasOwnProperty.call(game, 'providerGameId') &&
        Object.prototype.hasOwnProperty.call(game, 'providerTitle')
    )
  );
}

function uploadContent(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) invalidFile('Upload file must not be empty');
  if (buffer.includes(0)) invalidFile('Upload file contains binary data');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch {
    invalidFile('Upload file must be valid UTF-8 text');
  }
  const content = text.trim();
  if (!content) invalidFile('Upload file must not be blank');
  return content;
}

function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    invalidFile('Upload JSON is malformed');
  }
}

function parseLibraryUpload(buffer, mimeType, provider) {
  const content = uploadContent(buffer);
  if (mimeType === 'application/json' || mimeType === 'text/json') {
    const parsed = parseJson(content);
    if (Array.isArray(parsed)) return validateGames(parsed);
    if (isNeutralGameArray(parsed?.games)) return validateGames(parsed.games);
    if (['gog', 'epic', 'amazon'].includes(provider))
      return validateGames(legacyProviderGames(parsed, provider));
    invalidFile('JSON must be a game array or an object with a games array');
  }
  const rows = parseCsv(content);
  const [header, ...data] = rows;
  if (
    !header ||
    header.length !== 2 ||
    header[0] !== 'providerGameId' ||
    header[1] !== 'providerTitle'
  )
    invalidFile('CSV header must be exactly providerGameId,providerTitle');
  return validateGames(
    data
      .filter((row) => row.some((value) => value.trim()))
      .map((row) => ({ providerGameId: row[0], providerTitle: row[1] }))
  );
}

const HEROIC_PROVIDERS = {
  'gog_library.json': 'gog',
  'legendary_library.json': 'epic',
  'nile_library.json': 'amazon'
};

function resolveLibraryUpload({ buffer, mimeType, filename, provider }) {
  const basename = String(filename || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .toLowerCase();
  const detected = Object.hasOwn(HEROIC_PROVIDERS, basename) ? HEROIC_PROVIDERS[basename] : null;
  if (provider !== undefined && !['gog', 'epic', 'amazon'].includes(provider))
    invalidFile('provider must be gog, epic, or amazon');
  if (detected) {
    if (provider !== undefined && provider !== detected)
      invalidFile(
        `Filename identifies ${detected.toUpperCase()} but provider is ${provider.toUpperCase()}`
      );
    const parsed = parseJson(uploadContent(buffer));
    return { provider: detected, games: validateGames(legacyProviderGames(parsed, detected)) };
  }
  if (!provider) {
    // Decode and parse before reporting detection errors so malformed uploads stay actionable.
    const content = uploadContent(buffer);
    if (mimeType === 'application/json' || mimeType === 'text/json') parseJson(content);
    invalidFile(
      'Unsupported Heroic filename: use gog_library.json, legendary_library.json, or nile_library.json. Provider cannot be determined from this file.'
    );
  }
  return { provider, games: parseLibraryUpload(buffer, mimeType, provider) };
}

module.exports = { parseLibraryUpload, resolveLibraryUpload };
