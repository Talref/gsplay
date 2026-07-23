const User = require('../models/User');
const { createSteamClient, SteamProviderError } = require('../providers/steamClient');
const { createIgdbClient, IgdbProviderError } = require('../providers/igdbClient');
const { reconcileProviderLibrary } = require('../services/libraryReconciliation');
const CanonicalGame = require('../models/CanonicalGame');
const { ensureMetadataJob } = require('./jobService');
const { applyIgdbMetadata } = require('../services/catalogueStewardship');
function createJobHandlers(config, { steamClient, igdbClient, igdbGate, log = console } = {}) {
  const canEnrichMetadata = Boolean(config.providers.igdbClientId && config.providers.igdbClientSecret);
  // Keep one token cache for this worker process. Constructing this per job makes
  // every title acquire a new Twitch token and quickly triggers provider throttles.
  const sharedIgdbClient = igdbClient || (canEnrichMetadata ? createIgdbClient({ clientId: config.providers.igdbClientId, clientSecret: config.providers.igdbClientSecret }) : null);
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
      if (!canEnrichMetadata && !igdbClient) return { outcome: 'provider_stopped', stopProvider: true, diagnostics: [{ code: 'igdb_not_configured', message: 'IGDB credentials are not configured' }] };
      const igdb = sharedIgdbClient;
      let lookup;
      try {
        if (canonical.igdbId && igdb.getGameById) {
          const match = await (igdbGate ? igdbGate.run(() => igdb.getGameById(canonical.igdbId)) : igdb.getGameById(canonical.igdbId));
          lookup = match ? { outcome: 'matched', match } : { outcome: 'not_found', candidates: [] };
        } else if (igdb.searchTitle) lookup = await (igdbGate ? igdbGate.run(() => igdb.searchTitle(canonical.canonicalTitle)) : igdb.searchTitle(canonical.canonicalTitle));
        else {
          const match = await igdb.findExactTitle(canonical.canonicalTitle);
          lookup = match ? { outcome: 'matched', match } : { outcome: 'not_found', candidates: [] };
        }
      } catch (error) {
        if (!(error instanceof IgdbProviderError)) throw error;
        const status = error.status ? ` · httpStatus=${error.status}` : ''; const code = error.code ? ` · code=${error.code}` : '';
        log.warn(`⚠️ IGDB · request failed · game=${JSON.stringify(canonical.canonicalTitle)}${status}${code}`);
        if (error.authenticationFailed) return { title: canonical.canonicalTitle, outcome: 'provider_stopped', stopProvider: true, diagnostics: [{ code: 'igdb_authentication_failed', message: error.message }] };
        if (error.retryable) return { title: canonical.canonicalTitle, retryable: true, retryDelayMs: error.status === 429 ? config.igdb.cooldownMs : undefined, diagnostics: [{ code: 'igdb_request_failed', message: error.message }] };
        return { title: canonical.canonicalTitle, failed: true, diagnostics: [{ code: 'igdb_request_failed', message: error.message }] };
      }
      try {
        if (lookup.outcome !== 'matched') { canonical.metadata = { ...canonical.metadata.toObject(), status: 'failed', attempts: canonical.metadata.attempts + 1, lastSyncAt: new Date(), lastError: 'No verified IGDB match', nextRetryAt: undefined }; canonical.metadataCandidates = lookup.candidates || undefined; await canonical.save(); return { title: canonical.canonicalTitle, outcome: 'no_verified_match', diagnostics: [{ code: 'igdb_no_verified_match', message: 'IGDB returned no single verified match' }] }; }
        const applied = await applyIgdbMetadata({ game: canonical, metadata: lookup.match });
        if (applied.duplicate) {
          canonical.metadata = { ...canonical.metadata.toObject(), status: 'failed', attempts: canonical.metadata.attempts + 1, lastSyncAt: new Date(), lastError: `IGDB ID is already attached to ${applied.duplicate.canonicalTitle}`, nextRetryAt: undefined };
          canonical.metadataCandidates = [{ igdbId: lookup.match.igdbId, title: lookup.match.canonicalTitle, artwork: lookup.match.artwork, releaseDate: lookup.match.releaseDate, platforms: lookup.match.platforms, companies: lookup.match.companies, igdbUrl: lookup.match.igdbUrl }];
          await canonical.save();
          return { title: canonical.canonicalTitle, duplicateTitle: applied.duplicate.canonicalTitle, outcome: 'duplicate', diagnostics: [{ code: 'igdb_duplicate', message: `IGDB ID is already attached to ${applied.duplicate.canonicalTitle}`, itemReference: applied.duplicate._id.toString() }] };
        }
        return { title: canonical.canonicalTitle, outcome: 'matched', counts: { matched: 1, updated: 1 } };
      } catch (error) {
        log.error(`🧠 IGDB internal failure · game=${JSON.stringify(canonical.canonicalTitle)} · error=${JSON.stringify(error.message)}`);
        return { title: canonical.canonicalTitle, outcome: 'internal_failure', failed: true, diagnostics: [{ code: 'igdb_processing_failed', message: 'IGDB result processing failed' }] };
      }
    },
    async metadata_repair(job) {
      if (job.provider !== 'igdb') return { failed: true, diagnostics: [{ code: 'unsupported_provider', message: `No repair handler is registered for ${job.provider}` }] };
      if (!canEnrichMetadata) return { failed: true, diagnostics: [{ code: 'igdb_not_configured', message: 'IGDB credentials are not configured' }] };
      if (job.payload?.mode === 'refresh_all') {
        const now = new Date();
        const result = await CanonicalGame.updateMany({ hiddenAt: null, archivedAt: null, mergedIntoId: null }, { $set: { 'metadata.status': 'pending', 'metadata.nextRetryAt': now }, $unset: { 'metadata.lastError': 1 } });
        return { counts: { discovered: result.matchedCount, updated: result.modifiedCount }, diagnostics: [{ code: 'catalogue_refresh_queued', message: 'All active catalogue records are eligible for a bounded IGDB refresh' }] };
      }
      const now = new Date();
      const candidates = await CanonicalGame.find({ 'metadata.status': 'pending', hiddenAt: null, archivedAt: null, mergedIntoId: null }).select('_id metadata').limit(10_000);
      let queued = 0;
      for (const canonical of candidates) if (await ensureMetadataJob(canonical, { userId: job.userId, reason: 'admin_repair', maxAttempts: config.igdb.maxAttempts })) queued += 1;
      return { counts: { discovered: candidates.length, matched: queued }, diagnostics: queued === candidates.length ? [] : [{ code: 'metadata_jobs_already_active', message: `${candidates.length - queued} games already have active enrichment work` }] };
    }
  };
}
module.exports = { createJobHandlers };