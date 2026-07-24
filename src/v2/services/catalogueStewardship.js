const CanonicalGame = require('../models/CanonicalGame');
const CanonicalGameMerge = require('../models/CanonicalGameMerge');
const LibraryItem = require('../models/LibraryItem');
const GameAlias = require('../models/GameAlias');
const SyncJob = require('../models/SyncJob');
const CatalogueReassignment = require('../models/CatalogueReassignment');
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

async function providerIdentitiesForGame(gameId) {
  const rows = await LibraryItem.aggregate([
    { $match: { canonicalGameId: gameId, provider: { $in: ['steam', 'gog', 'epic', 'amazon'] } } },
    { $group: { _id: { provider: '$provider', providerGameId: '$providerGameId' }, titles: { $addToSet: '$providerTitle' }, activeEntitlementCount: { $sum: { $cond: [{ $eq: ['$removedAt', null] }, 1, 0] } }, activeUsers: { $addToSet: { $cond: [{ $eq: ['$removedAt', null] }, '$userId', '$$REMOVE'] } } } },
    { $lookup: { from: 'game_aliases_v2', let: { provider: '$_id.provider', providerGameId: '$_id.providerGameId' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$provider', '$$provider'] }, { $eq: ['$providerGameId', '$$providerGameId'] }] } } }, { $project: { canonicalGameId: 1, matchType: 1 } }], as: 'alias' } },
    { $sort: { '_id.provider': 1, '_id.providerGameId': 1 } }
  ]);
  return rows.map((row) => ({ provider: row._id.provider, providerGameId: row._id.providerGameId, providerTitles: row.titles.sort(), activeEntitlementCount: row.activeEntitlementCount, affectedUserCount: row.activeUsers.length, alias: row.alias[0] ? { canonicalGameId: row.alias[0].canonicalGameId.toString(), matchType: row.alias[0].matchType } : null }));
}

async function reassignProviderGame({ sourceGameId, targetGameId, provider, providerGameId, reassignedBy, reason }) {
  if (String(sourceGameId) === String(targetGameId)) throw new AppError(400, 'invalid_request', 'A provider game cannot be reassigned to the same canonical game');
  const [source, target] = await Promise.all([CanonicalGame.findOne({ _id: sourceGameId, mergedIntoId: null, archivedAt: null }), CanonicalGame.findOne({ _id: targetGameId, mergedIntoId: null, archivedAt: null })]);
  if (!source || !target) throw new AppError(404, 'not_found', 'An active canonical game was not found');
  const filter = { canonicalGameId: source._id, provider, providerGameId };
  const items = await LibraryItem.find(filter).select('providerTitle normalizedTitle removedAt userId');
  if (!items.length) throw new AppError(404, 'not_found', 'No provider entitlements for this game were found');
  const active = items.filter((item) => item.removedAt === null);
  const providerTitles = [...new Set(items.map((item) => item.providerTitle))].sort();
  const canonicalTitle = items[0].normalizedTitle;
  await LibraryItem.updateMany(filter, { $set: { canonicalGameId: target._id, matchStatus: 'manually_matched', matchConfidence: 1, matchMethod: 'admin_provider_reassignment' } });
  await GameAlias.updateOne({ provider, providerGameId }, { $set: { normalizedProviderTitle: canonicalTitle, canonicalGameId: target._id, matchType: 'manual', confidence: 1, reviewedBy: reassignedBy, reviewedAt: new Date() } }, { upsert: true });
  const audit = await CatalogueReassignment.create({ sourceGameId: source._id, targetGameId: target._id, provider, providerGameId, providerTitles, activeEntitlementCount: active.length, affectedUserCount: new Set(active.map((item) => item.userId.toString())).size, reassignedBy, reason });
  return { source, target, providerTitles, activeEntitlementCount: audit.activeEntitlementCount, affectedUserCount: audit.affectedUserCount, audit };
}

async function resetFailedMetadata() {
  const filter = { mergedIntoId: null, archivedAt: null, hiddenAt: null, 'metadata.status': 'failed' };
  const games = await CanonicalGame.find(filter).select('_id');
  const ids = games.map((game) => game._id);
  await SyncJob.updateMany({ provider: 'igdb', kind: 'metadata_enrichment', 'payload.canonicalGameId': { $in: ids.map(String) }, status: { $in: ['queued', 'running'] } }, { $set: { status: 'completed_with_errors', completedAt: new Date(), diagnostics: [{ code: 'admin_metadata_reset', message: 'Superseded by an admin metadata reset' }] } });
  const result = await CanonicalGame.updateMany({ _id: { $in: ids } }, { $set: { 'metadata.status': 'pending', 'metadata.attempts': 0, 'metadata.nextRetryAt': new Date() }, $unset: { metadataCandidates: 1, 'metadata.lastError': 1, 'metadata.lastSyncAt': 1 } });
  return { matched: ids.length, reset: result.modifiedCount };
}

module.exports = { applyIgdbMetadata, archiveCanonicalGame, createManualGame, mergeCanonicalGames, providerIdentitiesForGame, reassignProviderGame, resetFailedMetadata };