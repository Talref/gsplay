const CanonicalGame = require('../models/CanonicalGame');
const SyncJob = require('../models/SyncJob');
const { ensureMetadataJob } = require('./jobService');

const IGDB_LOG = '🧠 IGDB';

function createIgdbGate({ minIntervalMs = 500, cooldownMs = 60_000, now = () => Date.now(), sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), log = console } = {}) {
  let nextAllowedAt = 0;
  let cooldownUntil = 0;
  return {
    async run(action) {
      const waitMs = Math.max(0, nextAllowedAt - now(), cooldownUntil - now());
      if (waitMs) await sleep(waitMs);
      try {
        const result = await action();
        nextAllowedAt = now() + minIntervalMs;
        return result;
      } catch (error) {
        nextAllowedAt = now() + minIntervalMs;
        if (error?.status === 429 || error?.retryable && /rate limit/i.test(error.message || '')) {
          cooldownUntil = now() + cooldownMs;
          log.warn(`${IGDB_LOG} cooldown · reason=rate_limited · until=${new Date(cooldownUntil).toISOString()}`);
        }
        throw error;
      }
    },
    snapshot: () => ({ nextAllowedAt, cooldownUntil })
  };
}

async function reconcileIgdbMetadata({ config, userId, log = console } = {}) {
  const now = new Date();
  const staleRunning = await SyncJob.updateMany({ provider: 'igdb', kind: 'metadata_enrichment', status: 'running', leaseExpiresAt: { $lte: now } }, { $set: { status: 'queued', workerId: null, leaseExpiresAt: null, runAfter: now } });
  const legacyPending = await CanonicalGame.updateMany({ 'metadata.status': { $in: ['retryable_error', 'manual'] } }, { $set: { 'metadata.status': 'pending', 'metadata.nextRetryAt': now } });
  const legacyFailed = await CanonicalGame.updateMany({ 'metadata.status': { $in: ['not_found', 'ambiguous', 'permanent_error'] } }, { $set: { 'metadata.status': 'failed' } });
  const enabled = Boolean(config.providers.igdbClientId && config.providers.igdbClientSecret);
  const active = await SyncJob.countDocuments({ provider: 'igdb', kind: 'metadata_enrichment', status: { $in: ['queued', 'running'] } });
  const capacity = Math.max(0, config.igdb.queueLimit - active);
  const candidates = enabled && capacity ? await CanonicalGame.find({ 'metadata.status': 'pending', hiddenAt: null, archivedAt: null, mergedIntoId: null }).sort({ 'metadata.lastSyncAt': 1, createdAt: 1 }).limit(capacity).select('_id metadata') : [];
  let queued = 0;
  for (const canonical of candidates) if (await ensureMetadataJob(canonical, { userId, reason: 'worker_recovery', maxAttempts: config.igdb.maxAttempts })) queued += 1;
  const totals = await CanonicalGame.aggregate([{ $match: { hiddenAt: null, archivedAt: null, mergedIntoId: null } }, { $group: { _id: '$metadata.status', count: { $sum: 1 } } }]);
  const counts = Object.fromEntries(totals.map((row) => [row._id, row.count]));
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const complete = counts.complete || 0; const pending = counts.pending || 0; const failed = counts.failed || 0;
  log.info(`${IGDB_LOG} catalogue scan complete: ${total} active games — ${complete} up to date, ${pending} waiting for metadata, ${failed} need manual review. Queued ${queued} refresh job${queued === 1 ? '' : 's'}; ${active} already active.`);
  const migrated = legacyPending.modifiedCount + legacyFailed.modifiedCount;
  if (migrated) log.info(`${IGDB_LOG} maintenance: updated ${migrated} older metadata status record${migrated === 1 ? '' : 's'} to the current status names.`);
  if (staleRunning.modifiedCount) log.info(`${IGDB_LOG} maintenance: returned ${staleRunning.modifiedCount} expired job lease${staleRunning.modifiedCount === 1 ? '' : 's'} to the queue.`);
  if (enabled && !queued && !active && !pending) log.info(`${IGDB_LOG} idle: no automatic work remains. ${failed} game${failed === 1 ? '' : 's'} need${failed === 1 ? 's' : ''} manual review or an explicit retry; completed games can be refreshed from Admin operations.`);
  return { enabled, queued, active, staleLeases: staleRunning.modifiedCount, normalizedLegacy: legacyPending.modifiedCount + legacyFailed.modifiedCount, total, counts };
}

module.exports = { IGDB_LOG, createIgdbGate, reconcileIgdbMetadata };