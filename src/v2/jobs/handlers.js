const User = require('../models/User');
const { createSteamClient, SteamProviderError } = require('../providers/steamClient');
const { createIgdbClient, IgdbProviderError } = require('../providers/igdbClient');
const { reconcileProviderLibrary } = require('../services/libraryReconciliation');
const CanonicalGame = require('../models/CanonicalGame');
const { ensureMetadataJob } = require('./jobService');

function createJobHandlers(config, { steamClient, igdbClient } = {}) {
  const canEnrichMetadata = Boolean(config.providers.igdbClientId && config.providers.igdbClientSecret);
  return {
    async provider_sync(job) {
      if (job.provider !== 'steam') return { failed: true, diagnostics: [{ code: 'unsupported_provider', message: `No sync handler is registered for ${job.provider}` }] };
      const user = await User.findById(job.userId);
      if (!user?.steamAccount?.steamId) return { failed: true, diagnostics: [{ code: 'steam_not_linked', message: 'The account is no longer linked to Steam' }] };
      try {
        const steam = steamClient || createSteamClient({ apiKey: config.providers.steamApiKey });
        const games = await steam.listOwnedGames(user.steamAccount.steamId);
        const counts = await reconcileProviderLibrary({ userId: user._id, provider: 'steam', games, sourceImportId: job._id, enqueueMetadata: canEnrichMetadata });
        user.steamAccount.lastSyncedAt = new Date(); await user.save();
        return { counts };
      } catch (error) {
        const code = error instanceof SteamProviderError ? error.code : 'provider_error';
        return { failed: !error.retryable, retryable: Boolean(error.retryable), diagnostics: [{ code, message: error.message }] };
      }
    },
    async upload(job) {
      if (!['gog', 'epic', 'amazon'].includes(job.provider)) return { failed: true, diagnostics: [{ code: 'unsupported_provider', message: `Uploads are not supported for ${job.provider}` }] };
      const games = job.payload?.games;
      if (!Array.isArray(games)) return { failed: true, diagnostics: [{ code: 'invalid_upload_payload', message: 'Upload job has no validated game records' }] };
      const counts = await reconcileProviderLibrary({ userId: job.userId, provider: job.provider, games, sourceImportId: job._id, source: 'upload', removeAbsent: false, enqueueMetadata: canEnrichMetadata });
      return { counts };
    },
    async metadata_enrichment(job) {
      if (job.provider !== 'igdb') return { failed: true, diagnostics: [{ code: 'unsupported_provider', message: `No metadata handler is registered for ${job.provider}` }] };
      const gameId = job.payload?.canonicalGameId;
      const canonical = await CanonicalGame.findById(gameId);
      if (!canonical) return { failed: true, diagnostics: [{ code: 'canonical_game_not_found', message: 'Canonical game no longer exists' }] };
      try {
        const igdb = igdbClient || createIgdbClient({ clientId: config.providers.igdbClientId, clientSecret: config.providers.igdbClientSecret });
        const metadata = await igdb.findExactTitle(canonical.canonicalTitle);
        if (!metadata) { canonical.metadata = { ...canonical.metadata.toObject(), status: 'not_found', attempts: canonical.metadata.attempts + 1, lastSyncAt: new Date(), lastError: undefined, nextRetryAt: undefined }; await canonical.save(); return { diagnostics: [{ code: 'igdb_not_found', message: 'No unique exact IGDB title match was found' }] }; }
        Object.assign(canonical, metadata, { metadata: { status: 'complete', attempts: canonical.metadata.attempts + 1, lastSyncAt: new Date(), lastError: undefined, nextRetryAt: undefined } }); await canonical.save();
        return { counts: { matched: 1, updated: 1 } };
      } catch (error) {
        const retryable = error instanceof IgdbProviderError && error.retryable;
        canonical.metadata = { ...canonical.metadata.toObject(), status: retryable ? 'retryable_error' : 'permanent_error', attempts: canonical.metadata.attempts + 1, lastError: error.message, nextRetryAt: retryable ? new Date() : undefined }; await canonical.save();
        return { failed: !retryable, retryable, diagnostics: [{ code: retryable ? 'igdb_retryable_error' : 'igdb_error', message: error.message }] };
      }
    },
    async metadata_repair(job) {
      if (job.provider !== 'igdb') return { failed: true, diagnostics: [{ code: 'unsupported_provider', message: `No repair handler is registered for ${job.provider}` }] };
      if (!canEnrichMetadata) return { failed: true, diagnostics: [{ code: 'igdb_not_configured', message: 'IGDB credentials are not configured' }] };
      const now = new Date();
      const candidates = await CanonicalGame.find({ $or: [{ 'metadata.status': 'pending' }, { 'metadata.status': 'retryable_error', 'metadata.nextRetryAt': { $lte: now } }] }).select('_id metadata').limit(10_000);
      let queued = 0;
      for (const canonical of candidates) if (await ensureMetadataJob(canonical, { userId: job.userId, reason: 'admin_repair' })) queued += 1;
      return { counts: { discovered: candidates.length, matched: queued }, diagnostics: queued === candidates.length ? [] : [{ code: 'metadata_jobs_already_active', message: `${candidates.length - queued} games already have active enrichment work` }] };
    }
  };
}
module.exports = { createJobHandlers };