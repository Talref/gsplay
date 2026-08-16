const CanonicalGame = require('../models/CanonicalGame');
const GameAlias = require('../models/GameAlias');
const LibraryItem = require('../models/LibraryItem');
const MostWantedSnapshot = require('../models/MostWantedSnapshot');
const User = require('../models/User');

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

const member = (user) => ({ userId: user._id, username: user.usernameDisplay });

async function ownerMap(gameIds) {
  if (!gameIds.length) return new Map();
  const rows = await LibraryItem.aggregate([
    { $match: { canonicalGameId: { $in: gameIds }, removedAt: null } },
    { $group: { _id: { gameId: '$canonicalGameId', userId: '$userId' } } },
    { $lookup: { from: 'users_v2', localField: '_id.userId', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $sort: { 'user.usernameDisplay': 1, '_id.userId': 1 } },
    {
      $group: {
        _id: '$_id.gameId',
        users: {
          $push: { userId: '$_id.userId', username: '$user.usernameDisplay' }
        }
      }
    }
  ]);
  return new Map(rows.map((row) => [row._id.toString(), row.users]));
}

async function recordFailure({ attemptedAt, profilesEligible, code, message }) {
  await MostWantedSnapshot.findOneAndUpdate(
    { key: 'current' },
    {
      $set: {
        lastAttemptAt: attemptedAt,
        lastError: { code, message }
      },
      $setOnInsert: {
        key: 'current',
        games: [],
        profileCaches: [],
        profilesEligible,
        profilesIncluded: 0,
        profilesUnavailable: profilesEligible,
        profilesCached: 0
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { updated: false, profilesEligible, profilesIncluded: 0 };
}

async function refreshMostWanted({ steamClient, now = new Date(), log = console }) {
  const [users, previous] = await Promise.all([
    User.find({ 'steamAccount.steamId': /^\d{17}$/ })
      .select('_id usernameDisplay steamAccount.steamId')
      .sort({ _id: 1 }),
    MostWantedSnapshot.findOne({ key: 'current' }).select('profileCaches').lean()
  ]);
  const previousCache = new Map(
    (previous?.profileCaches || []).map((cache) => [cache.userId.toString(), cache])
  );
  const fetched = await mapWithConcurrency(users, 3, async (user) => {
    try {
      return { user, appIds: await steamClient.listWishlist(user.steamAccount.steamId) };
    } catch (error) {
      log.warn(
        `Steam wishlist unavailable for GSPlay user ${user._id}: ${error.code || 'steam_error'}`
      );
      const cached = previousCache.get(user._id.toString());
      if (error.retryable && cached?.steamId === user.steamAccount.steamId)
        return {
          user,
          appIds: cached.appIds,
          cached: true,
          fetchedAt: cached.fetchedAt
        };
      return { user, error };
    }
  });
  const available = fetched.filter((result) => !result.error);
  const fresh = available.filter((result) => !result.cached);
  if (users.length && !fresh.length)
    return recordFailure({
      attemptedAt: now,
      profilesEligible: users.length,
      code: 'no_accessible_profiles',
      message: 'Steam returned no accessible wishlist profiles; the previous snapshot was preserved.'
    });

  const allAppIds = [...new Set(available.flatMap((result) => result.appIds))];
  const aliases = allAppIds.length
    ? await GameAlias.find({ provider: 'steam', providerGameId: { $in: allAppIds } }).lean()
    : [];
  const gameIds = [...new Set(aliases.map((alias) => alias.canonicalGameId.toString()))];
  const games = gameIds.length
    ? await CanonicalGame.find({
        _id: { $in: gameIds },
        hiddenAt: null,
        archivedAt: null,
        mergedIntoId: null
      })
        .select('_id canonicalTitle artwork')
        .lean()
    : [];
  const gamesById = new Map(games.map((game) => [game._id.toString(), game]));
  const aliasByAppId = new Map(
    aliases
      .filter((alias) => gamesById.has(alias.canonicalGameId.toString()))
      .map((alias) => [alias.providerGameId, alias.canonicalGameId.toString()])
  );
  const demand = new Map();
  for (const result of available) {
    const userGames = new Map();
    for (const appId of result.appIds) {
      const gameId = aliasByAppId.get(appId);
      if (!gameId) continue;
      if (!userGames.has(gameId)) userGames.set(gameId, new Set());
      userGames.get(gameId).add(appId);
    }
    for (const [gameId, appIds] of userGames) {
      if (!demand.has(gameId)) demand.set(gameId, { users: [], appIds: new Set() });
      const entry = demand.get(gameId);
      entry.users.push(member(result.user));
      appIds.forEach((appId) => entry.appIds.add(appId));
    }
  }
  const owners = await ownerMap([...demand.keys()].map((id) => gamesById.get(id)._id));
  const snapshotGames = [...demand.entries()]
    .map(([gameId, entry]) => {
      const game = gamesById.get(gameId);
      const ownedBy = owners.get(gameId) || [];
      return {
        canonicalGameId: game._id,
        title: game.canonicalTitle,
        artwork: game.artwork,
        steamAppIds: [...entry.appIds].sort((left, right) => Number(left) - Number(right)),
        wishlistCount: entry.users.length,
        ownerCount: ownedBy.length,
        wishlistedBy: entry.users.sort((left, right) =>
          left.username.localeCompare(right.username, 'it', { sensitivity: 'base' })
        ),
        ownedBy
      };
    })
    .sort(
      (left, right) =>
        right.wishlistCount - left.wishlistCount ||
        left.title.localeCompare(right.title, 'it', { sensitivity: 'base' }) ||
        left.canonicalGameId.toString().localeCompare(right.canonicalGameId.toString())
    );
  const matchedAppIds = new Set(aliasByAppId.keys());
  const unmatchedAppCount = allAppIds.filter((appId) => !matchedAppIds.has(appId)).length;
  await MostWantedSnapshot.findOneAndUpdate(
    { key: 'current' },
    {
      $set: {
        generatedAt: now,
        lastAttemptAt: now,
        lastError: null,
        profilesEligible: users.length,
        profilesIncluded: available.length,
        profilesUnavailable: users.length - available.length,
        profilesCached: available.filter((result) => result.cached).length,
        unmatchedAppCount,
        profileCaches: available.map((result) => ({
          userId: result.user._id,
          steamId: result.user.steamAccount.steamId,
          appIds: result.appIds,
          fetchedAt: result.cached ? result.fetchedAt : now
        })),
        games: snapshotGames
      },
      $setOnInsert: { key: 'current' }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return {
    updated: true,
    profilesEligible: users.length,
    profilesIncluded: available.length,
    profilesCached: available.filter((result) => result.cached).length,
    games: snapshotGames.length,
    unmatchedAppCount
  };
}

async function refreshMostWantedIfDue({ config, steamClient, now = new Date(), log = console }) {
  const snapshot = await MostWantedSnapshot.findOne({ key: 'current' })
    .select('lastAttemptAt generatedAt')
    .lean();
  const lastRun = snapshot?.lastAttemptAt || snapshot?.generatedAt;
  if (lastRun && now.getTime() - lastRun.getTime() < config.mostWanted.refreshMs)
    return { due: false };
  return { due: true, ...(await refreshMostWanted({ steamClient, now, log })) };
}

module.exports = { refreshMostWanted, refreshMostWantedIfDue };
