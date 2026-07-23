const CanonicalGame = require('../models/CanonicalGame');
const CanonicalGameMerge = require('../models/CanonicalGameMerge');
const LibraryItem = require('../models/LibraryItem');
const GameAlias = require('../models/GameAlias');
const SyncJob = require('../models/SyncJob');
const { normalizeTitle } = require('./titleNormalization');
const { AppError } = require('../http/errors');

const METADATA_FIELDS = ['canonicalTitle', 'alternativeTitles', 'summary', 'genres', 'platforms', 'gameModes', 'rating', 'artwork', 'releaseDate', 'videos', 'companies', 'igdbUrl'];

function pickMetadata(metadata, locks = []) {
  return Object.fromEntries(METADATA_FIELDS.filter((field) => !locks.includes(field) && metadata[field] !== undefined).map((field) => [field, metadata[field]]));
}

async function applyIgdbMetadata({ game, metadata, reviewedBy, locks = game.fieldLocks || [] }) {
  const duplicate = await CanonicalGame.findOne({ igdbId: metadata.igdbId, _id: { $ne: game._id }, mergedIntoId: null }).select('_id canonicalTitle');
  if (duplicate) return { duplicate };
  Object.assign(game, pickMetadata(metadata, locks), {
    igdbId: metadata.igdbId,
    metadataCandidates: undefined,
    metadataReviewedBy: reviewedBy || undefined,
    metadataReviewedAt: new Date(),
    metadata: { status: 'complete', attempts: game.metadata.attempts + 1, lastSyncAt: new Date(), lastError: undefined, nextRetryAt: undefined }
  });
  await game.save();
  return { game };
}

async function createManualGame({ title, reviewedBy, independent = true, metadata = {} }) {
  const canonicalTitle = String(title).trim();
  const normalizedTitle = normalizeTitle(canonicalTitle);
  if (!normalizedTitle) throw new AppError(400, 'invalid_request', 'title must contain letters or numbers');
  return CanonicalGame.create({ canonicalTitle, normalizedTitle, origin: 'manual_catalogue', storeAvailability: independent ? 'independent' : 'store', ...pickMetadata(metadata), metadata: { status: 'pending' }, metadataReviewedBy: reviewedBy, metadataReviewedAt: new Date() });
}

async function archiveCanonicalGame({ gameId, archivedBy, reason }) {
  const game = await CanonicalGame.findOne({ _id: gameId, mergedIntoId: null, archivedAt: null });
  if (!game) throw new AppError(404, 'not_found', 'An active canonical game was not found');
  const [entitlements, aliases] = await Promise.all([LibraryItem.countDocuments({ canonicalGameId: game._id, removedAt: null }), GameAlias.countDocuments({ canonicalGameId: game._id })]);
  if (entitlements || aliases) throw new AppError(409, 'game_has_references', 'A referenced game must be merged instead of archived', { entitlements, aliases });
  game.archivedAt = new Date(); game.archivedBy = archivedBy; game.archiveReason = reason; await game.save();
  return game;
}

async function mergeCanonicalGames({ sourceGameId, targetGameId, mergedBy, reason }) {
  if (String(sourceGameId) === String(targetGameId)) throw new AppError(400, 'invalid_request', 'A game cannot be merged into itself');
  const [source, target] = await Promise.all([CanonicalGame.findById(sourceGameId), CanonicalGame.findById(targetGameId)]);
  if (!source || !target || source.mergedIntoId || target.mergedIntoId) throw new AppError(404, 'not_found', 'An active canonical game was not found');
  const existing = await CanonicalGameMerge.findOne({ sourceGameId: source._id });
  if (existing) return { source, target: await CanonicalGame.findById(existing.targetGameId), alreadyMerged: true };
  await LibraryItem.updateMany({ canonicalGameId: source._id }, { $set: { canonicalGameId: target._id } });
  const aliases = await GameAlias.find({ canonicalGameId: source._id });
  for (const alias of aliases) {
    const collision = await GameAlias.findOne({ provider: alias.provider, normalizedProviderTitle: alias.normalizedProviderTitle, canonicalGameId: target._id, _id: { $ne: alias._id } });
    if (collision) await GameAlias.deleteOne({ _id: alias._id });
    else await GameAlias.updateOne({ _id: alias._id }, { $set: { canonicalGameId: target._id } });
  }
  await SyncJob.updateMany({ provider: 'igdb', kind: 'metadata_enrichment', 'payload.canonicalGameId': source._id.toString(), status: { $in: ['queued', 'running'] } }, { $set: { status: 'completed_with_errors', completedAt: new Date(), diagnostics: [{ code: 'canonical_game_merged', message: `Canonical game merged into ${target._id}` }] } });
  const titles = [...new Set([...(target.alternativeTitles || []), target.canonicalTitle, source.canonicalTitle, ...(source.alternativeTitles || [])])].filter((title) => title !== target.canonicalTitle).slice(0, 50);
  target.alternativeTitles = titles;
  await target.save();
  source.mergedIntoId = target._id;
  await source.save();
  await CanonicalGameMerge.create({ sourceGameId: source._id, targetGameId: target._id, mergedBy, reason });
  return { source, target, alreadyMerged: false };
}

async function resetFailedMetadata() {
  const filter = { mergedIntoId: null, archivedAt: null, hiddenAt: null, 'metadata.status': 'failed' };
  const games = await CanonicalGame.find(filter).select('_id');
  const ids = games.map((game) => game._id);
  await SyncJob.updateMany({ provider: 'igdb', kind: 'metadata_enrichment', 'payload.canonicalGameId': { $in: ids.map(String) }, status: { $in: ['queued', 'running'] } }, { $set: { status: 'completed_with_errors', completedAt: new Date(), diagnostics: [{ code: 'admin_metadata_reset', message: 'Superseded by an admin metadata reset' }] } });
  const result = await CanonicalGame.updateMany({ _id: { $in: ids } }, { $set: { 'metadata.status': 'pending', 'metadata.attempts': 0, 'metadata.nextRetryAt': new Date() }, $unset: { metadataCandidates: 1, 'metadata.lastError': 1, 'metadata.lastSyncAt': 1 } });
  return { matched: ids.length, reset: result.modifiedCount };
}

module.exports = { applyIgdbMetadata, archiveCanonicalGame, createManualGame, mergeCanonicalGames, resetFailedMetadata };