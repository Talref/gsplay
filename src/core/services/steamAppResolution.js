const SteamAppCache = require('../models/SteamAppCache');
const { normalizeTitle } = require('./titleNormalization');

const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

async function resolveSteamAppTitles({ appIds, steamClient, now = new Date(), log = console }) {
  if (!appIds.length) return new Map();
  const cached = await SteamAppCache.find({ providerGameId: { $in: appIds } }).lean();
  const cacheById = new Map(cached.map((entry) => [entry.providerGameId, entry]));
  const staleBefore = new Date(now.getTime() - CACHE_MAX_AGE_MS);
  const refreshIds = appIds.filter((appId) => {
    const entry = cacheById.get(appId);
    return !entry || entry.checkedAt < staleBefore;
  });

  if (refreshIds.length && typeof steamClient.listAppNames === 'function') {
    try {
      const resolved = await steamClient.listAppNames(refreshIds);
      const resolvedById = new Map(
        resolved.map((entry) => [String(entry.providerGameId), entry.providerTitle.trim()])
      );
      await SteamAppCache.bulkWrite(
        refreshIds.map((providerGameId) => {
          const providerTitle = resolvedById.get(providerGameId) || null;
          return {
            updateOne: {
              filter: { providerGameId },
              update: {
                $set: {
                  providerTitle,
                  normalizedTitle: providerTitle ? normalizeTitle(providerTitle) : null,
                  found: Boolean(providerTitle),
                  checkedAt: now
                }
              },
              upsert: true
            }
          };
        })
      );
      for (const providerGameId of refreshIds) {
        const providerTitle = resolvedById.get(providerGameId) || null;
        cacheById.set(providerGameId, {
          providerGameId,
          providerTitle,
          normalizedTitle: providerTitle ? normalizeTitle(providerTitle) : null,
          found: Boolean(providerTitle),
          checkedAt: now
        });
      }
    } catch (error) {
      log.warn(`Steam app names unavailable: ${error.code || 'steam_error'}`);
    }
  }

  return new Map(
    [...cacheById.values()]
      .filter((entry) => entry.found && entry.providerTitle)
      .map((entry) => [entry.providerGameId, entry.providerTitle])
  );
}

module.exports = { CACHE_MAX_AGE_MS, resolveSteamAppTitles };
