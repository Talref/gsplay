const { TextDecoder } = require('node:util');
const { AppError } = require('../http/errors');

const MAX_IMPORT_GAMES = 5_000;

function invalidFile(message) {
  throw new AppError(400, 'invalid_import_file', message);
}

function parseCsv(text) {
  const rows = []; let row = []; let value = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(value); value = ''; }
    else if (character === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += character;
  }
  if (quoted) invalidFile('CSV contains an unterminated quoted value');
  if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

function validateGames(games) {
  if (!Array.isArray(games) || !games.length || games.length > MAX_IMPORT_GAMES) invalidFile(`Import must contain between 1 and ${MAX_IMPORT_GAMES} games`);
  return games.map((game, index) => {
    if (!game || typeof game !== 'object' || Array.isArray(game)) invalidFile(`Game ${index + 1} must be an object`);
    const providerGameId = typeof game.providerGameId === 'string' ? game.providerGameId.trim() : '';
    const providerTitle = typeof game.providerTitle === 'string' ? game.providerTitle.trim() : '';
    if (!providerGameId || providerGameId.length > 256 || !providerTitle || providerTitle.length > 512) invalidFile(`Game ${index + 1} requires providerGameId and providerTitle within supported lengths`);
    return { providerGameId, providerTitle };
  });
}

function parseLibraryUpload(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) invalidFile('Upload file must not be empty');
  if (buffer.includes(0)) invalidFile('Upload file contains binary data');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, ''); } catch { invalidFile('Upload file must be valid UTF-8 text'); }
  const content = text.trim();
  if (!content) invalidFile('Upload file must not be blank');
  if (mimeType === 'application/json' || mimeType === 'text/json') {
    let parsed;
    try { parsed = JSON.parse(content); } catch { invalidFile('Upload JSON is malformed'); }
    return validateGames(Array.isArray(parsed) ? parsed : parsed.games);
  }
  const rows = parseCsv(content);
  const [header, ...data] = rows;
  if (!header || header.length !== 2 || header[0] !== 'providerGameId' || header[1] !== 'providerTitle') invalidFile('CSV header must be exactly providerGameId,providerTitle');
  return validateGames(data.filter((row) => row.some((value) => value.trim())).map((row) => ({ providerGameId: row[0], providerTitle: row[1] })));
}

module.exports = { parseLibraryUpload };