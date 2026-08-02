const { AppError } = require('../../http/errors');
const { string } = require('../../http/validate');
const { applyIgdbMetadata, mergeCanonicalGames } = require('../../services/catalogueStewardship');
const { normalizeTitle } = require('../../services/titleNormalization');

const lockableFields = [
  'canonicalTitle',
  'summary',
  'artwork',
  'genres',
  'platforms',
  'releaseDate'
];

function assertStringList(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new AppError(400, 'invalid_request', `${field} must be a string array`);
  }
  return value;
}

function stringList(value, field) {
  assertStringList(value, field);
  return value
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function applyEditableMetadata(game, body) {
  if (body.title !== undefined) {
    game.canonicalTitle = string(body.title, 'title');
    game.normalizedTitle = normalizeTitle(game.canonicalTitle);
  }
  if (body.summary !== undefined) {
    game.summary = string(body.summary, 'summary', { min: 0, max: 10000 });
  }
  if (body.artwork !== undefined) {
    game.artwork =
      body.artwork === null ? undefined : string(body.artwork, 'artwork', { max: 2048 });
  }
  if (body.genres !== undefined) game.genres = stringList(body.genres, 'genres');
  if (body.platforms !== undefined) game.platforms = stringList(body.platforms, 'platforms');
  if (body.releaseDate !== undefined) {
    if (body.releaseDate === null) game.releaseDate = undefined;
    else {
      const date = new Date(body.releaseDate);
      if (Number.isNaN(date.getTime())) {
        throw new AppError(400, 'invalid_request', 'releaseDate must be a valid date');
      }
      game.releaseDate = date;
    }
  }
}

function applyFieldLocks(game, fieldLocks) {
  if (fieldLocks === undefined) return;
  if (!Array.isArray(fieldLocks) || fieldLocks.some((field) => !lockableFields.includes(field))) {
    throw new AppError(400, 'invalid_request', 'fieldLocks contains an unsupported field');
  }
  game.fieldLocks = [...new Set(fieldLocks)];
}

async function resolveIgdbMetadata({ game, metadata, reviewedBy }) {
  const applied = await applyIgdbMetadata({ game, metadata, reviewedBy });
  if (!applied.duplicate) return { game: applied.game, merged: false };

  const merged = await mergeCanonicalGames({
    sourceGameId: game._id,
    targetGameId: applied.duplicate._id,
    mergedBy: reviewedBy,
    reason: `Verified IGDB identity ${metadata.igdbId} selected during admin metadata review`
  });
  return { game: merged.target, merged: true, sourceGameId: game._id.toString() };
}

module.exports = {
  applyEditableMetadata,
  applyFieldLocks,
  assertStringList,
  resolveIgdbMetadata
};
