require('dotenv').config();
const { loadEnvironment } = require('./config/environment');
const { connectDatabase, disconnectDatabase } = require('./database');
const {
  claimNextJob,
  completeJob,
  createWorkerId,
  deferJob,
  retryJob
} = require('./jobs/jobService');
const { createJobHandlers } = require('./jobs/handlers');
const { createIgdbGate, reconcileIgdbMetadata } = require('./jobs/igdbScheduler');
const CanonicalGame = require('./models/CanonicalGame');
const { createItadClient } = require('./providers/itadClient');
const { createSteamClient } = require('./providers/steamClient');
const {
  completeElapsedPlaylists,
  refreshRotationOffers
} = require('./services/casualFridayService');
const { refreshMostWantedIfDue } = require('./services/mostWantedService');

async function startWorker({ pollMs = 1_000 } = {}) {
  const config = loadEnvironment();
  if (!config.workerEnabled) return null;
  await connectDatabase(config);
  const workerId = createWorkerId();
  const igdbGate = createIgdbGate(config.igdb);
  const itadClient = createItadClient({ apiKey: config.providers.itadApiKey });
  const steamClient = createSteamClient({ apiKey: config.providers.steamApiKey });
  const handlers = createJobHandlers(config, { igdbGate });
  let stopping = false;
  let draining = false;
  let igdbPausedUntil = 0;
  let metadataSettled = false;
  const drain = async () => {
    if (stopping || draining) return;
    draining = true;
    try {
      while (!stopping) {
        const metadataPaused = Date.now() < igdbPausedUntil;
        const job = await claimNextJob(workerId, 60_000, { excludeMetadata: metadataPaused });
        if (!job) {
          if (!metadataPaused && !metadataSettled) {
            const report = await reconcileIgdbMetadata({ config, log: console });
            metadataSettled = report.queued === 0;
            if (report.queued) continue;
          }
          return;
        }
        metadataSettled = false;
        const handler = handlers[job.kind];
        let result;
        try {
          result = handler
            ? await handler(job)
            : {
                failed: true,
                diagnostics: [
                  {
                    code: 'handler_not_registered',
                    message: `No worker handler is registered for ${job.kind}`
                  }
                ]
              };
        } catch {
          result =
            job.provider === 'igdb' && job.kind === 'metadata_enrichment'
              ? {
                  outcome: 'internal_failure',
                  failed: true,
                  diagnostics: [
                    {
                      code: 'igdb_worker_error',
                      message: 'IGDB worker handler failed unexpectedly'
                    }
                  ]
                }
              : {
                  retryable: true,
                  diagnostics: [
                    { code: 'worker_error', message: 'Worker handler failed unexpectedly' }
                  ]
                };
        }
        const isIgdb = job.provider === 'igdb' && job.kind === 'metadata_enrichment';
        const persisted = result.stopProvider
          ? await deferJob(job, result)
          : result.retryable
            ? await retryJob(job, result, { delayMs: result.retryDelayMs })
            : await completeJob(job, result);
        if (!persisted) throw new Error(`Job completion lease was lost for ${job._id}`);
        if (isIgdb && result.retryable)
          await CanonicalGame.updateOne(
            { _id: job.payload?.canonicalGameId },
            { $set: { 'metadata.nextRetryAt': persisted.runAfter } }
          );
        if (isIgdb && !result.stopProvider) {
          const marker =
            result.outcome === 'matched' ? '✅' : result.outcome === 'duplicate' ? '⚠️' : '❌';
          const detail =
            result.outcome === 'duplicate'
              ? `duplicate of ${JSON.stringify(result.duplicateTitle)}`
              : result.outcome || (result.failed ? 'failed' : 'no_verified_match');
          console.info(
            `${marker} IGDB · ${JSON.stringify(result.title || job.payload?.canonicalGameId)} · ${detail}`
          );
        }
        if (isIgdb && result.stopProvider) {
          igdbPausedUntil = Date.now() + config.igdb.maintenanceMs;
          console.warn(
            `🧠 IGDB auth paused · retrying at ${new Date(igdbPausedUntil).toISOString()}`
          );
        }
      }
    } finally {
      draining = false;
    }
  };
  const tick = () => drain().catch((error) => console.error('v2 worker tick failed', error));
  // Reconciliation is also performed by drain() when it finds no work. Record
  // this startup result so the first tick does not print the same scan twice.
  const startupReport = await reconcileIgdbMetadata({ config, log: console });
  metadataSettled = startupReport.queued === 0;
  const timer = setInterval(tick, pollMs);
  const maintenance = () =>
    Promise.all([
      reconcileIgdbMetadata({ config, log: console }),
      completeElapsedPlaylists().then(
        (count) =>
          count &&
          console.info(
            `🎲 Casual Friday completed ${count} elapsed playlist${count === 1 ? '' : 's'}`
          )
      )
    ]).catch((error) => console.error('worker maintenance failed', error));
  const maintenanceTimer = setInterval(maintenance, config.igdb.maintenanceMs);
  const priceMaintenance = () =>
    refreshRotationOffers({ itadClient })
      .then(({ checked, offers, batches }) =>
        console.info(
          `💸 ITAD prices refreshed: ${checked} rotation games, ${offers} offers, ${batches} batches`
        )
      )
      .catch((error) => console.error('ITAD price refresh failed', error));
  const priceTimer = setInterval(priceMaintenance, config.itad.priceRefreshMs);
  let mostWantedRunning = false;
  const mostWantedMaintenance = async () => {
    if (mostWantedRunning) return;
    mostWantedRunning = true;
    try {
      const result = await refreshMostWantedIfDue({ config, steamClient });
      if (result.due && result.updated)
        console.info(
          `🔥 Most Wanted refreshed: ${result.games} games from ${result.profilesIncluded}/${result.profilesEligible} Steam profiles`
        );
      if (result.due && !result.updated)
        console.warn('Most Wanted refresh produced no valid profile data; cached data preserved');
    } catch (error) {
      console.error('Most Wanted refresh failed', error);
    } finally {
      mostWantedRunning = false;
    }
  };
  const mostWantedTimer = setInterval(mostWantedMaintenance, config.mostWanted.refreshMs);
  void mostWantedMaintenance();
  await priceMaintenance();
  await tick();
  const shutdown = async () => {
    stopping = true;
    clearInterval(timer);
    clearInterval(maintenanceTimer);
    clearInterval(priceTimer);
    clearInterval(mostWantedTimer);
    await disconnectDatabase();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return { workerId, shutdown };
}
if (require.main === module)
  startWorker().catch((error) => {
    console.error(error);
    process.exit(1);
  });
module.exports = { startWorker };
