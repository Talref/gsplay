const LibraryItem = require('../models/LibraryItem');
const GameAlias = require('../models/GameAlias');
const CanonicalGame = require('../models/CanonicalGame');
const { normalizeTitle } = require('./titleNormalization');
const { ensureMetadataJob } = require('../jobs/jobService');

async function reconcileProviderLibrary({ userId, provider, games, sourceImportId, source = 'api', removeAbsent = true, enqueueMetadata = false }) {
  const observedIds = new Set(); let created = 0; let updated = 0;
  for (const game of games) {
    const providerGameId = String(game.providerGameId); const providerTitle = String(game.providerTitle).trim(); const normalizedTitle = normalizeTitle(providerTitle);
    if (!providerGameId || !providerTitle || !normalizedTitle) continue;
    observedIds.add(providerGameId);
    const alias = await GameAlias.findOne({ provider, providerGameId });
    const update = { providerTitle, normalizedTitle, source, sourceImportId, lastSeenAt: new Date(), removedAt: null };
    if (alias) Object.assign(update, { canonicalGameId: alias.canonicalGameId, matchStatus: alias.matchType === 'manual' ? 'manually_matched' : 'auto_matched', matchConfidence: alias.confidence, matchMethod: alias.matchType });
    else {
      const candidates = await CanonicalGame.find({ normalizedTitle }).select('_id').limit(2).lean();
      if (candidates.length === 1) Object.assign(update, { canonicalGameId: candidates[0]._id, matchStatus: 'auto_matched', matchConfidence: 1, matchMethod: 'exact_normalized_title' });
      else if (candidates.length > 1) Object.assign(update, { canonicalGameId: null, matchStatus: 'ambiguous', matchConfidence: 0, matchMethod: 'multiple_exact_normalized_titles' });
      else {
        const canonical = await CanonicalGame.create({ canonicalTitle: providerTitle, normalizedTitle, metadata: { status: 'pending' } });
        if (enqueueMetadata) await ensureMetadataJob(canonical, { userId, reason: 'library_discovery' });
        Object.assign(update, { canonicalGameId: canonical._id, matchStatus: 'auto_matched', matchConfidence: 0.75, matchMethod: 'provisional_exact_title' });
      }
    }
    if (enqueueMetadata && update.canonicalGameId) {
      const canonical = await CanonicalGame.findById(update.canonicalGameId).select('_id metadata');
      await ensureMetadataJob(canonical, { userId, reason: 'library_reconciliation' });
    }
    const existing = await LibraryItem.findOneAndUpdate({ userId, provider, providerGameId }, { $set: update, $setOnInsert: { userId, provider, providerGameId, firstSeenAt: new Date() } }, { new: true, upsert: true });
    if (existing.createdAt.getTime() === existing.updatedAt.getTime()) created += 1; else updated += 1;
  }
  const removal = removeAbsent ? await LibraryItem.updateMany({ userId, provider, removedAt: null, providerGameId: { $nin: [...observedIds] } }, { $set: { removedAt: new Date() } }) : { modifiedCount: 0 };
  return { discovered: games.length, created, updated, removed: removal.modifiedCount };
}
module.exports = { reconcileProviderLibrary };