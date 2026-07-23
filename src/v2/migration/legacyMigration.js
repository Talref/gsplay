const mongoose = require('mongoose');
const { normalizeTitle } = require('../services/titleNormalization');

const PROVIDERS = new Set(['steam', 'gog', 'epic', 'amazon']);

function displayName(value) { return String(value || '').trim(); }
function usernameKey(value) { return displayName(value).toLocaleLowerCase('en-US'); }
function providerOf(value) { const provider = String(value || '').trim().toLowerCase(); return PROVIDERS.has(provider) ? provider : null; }
function asDate(value, fallback) { const date = value ? new Date(value) : fallback; return Number.isNaN(date?.getTime()) ? fallback : date; }
function gameQuality(game) { return ['description', 'artwork', 'releaseDate', 'igdbUrl'].filter((field) => Boolean(game[field])).length + (game.genres?.length || 0) + (game.availablePlatforms?.length || 0) + (game.publishers?.length || 0); }
function stableGameOrder(left, right) { const created = asDate(left.createdAt, new Date(0)).getTime() - asDate(right.createdAt, new Date(0)).getTime(); return created || String(left._id).localeCompare(String(right._id)); }

function collapseLegacyGames(games) {
  const byIgdbId = new Map(); const withoutIgdb = [];
  for (const game of games) {
    if (Number.isInteger(game.igdbId)) byIgdbId.set(game.igdbId, [...(byIgdbId.get(game.igdbId) || []), game]);
    else withoutIgdb.push(game);
  }
  const collapsed = []; const titleTargets = new Map(); let duplicateGroups = 0; let duplicateRecords = 0;
  for (const group of byIgdbId.values()) {
    const ordered = [...group].sort(stableGameOrder);
    const survivor = [...ordered].sort((left, right) => gameQuality(right) - gameQuality(left) || stableGameOrder(left, right))[0];
    if (group.length > 1) {
      duplicateGroups += 1; duplicateRecords += group.length - 1;
      survivor.alternativeTitles = [...new Set([...group.map((game) => displayName(game.name)), ...(survivor.alternativeTitles || [])].filter((title) => title && title !== displayName(survivor.name)))];
    }
    for (const game of group) titleTargets.set(normalizeTitle(displayName(game.name)), survivor._id);
    collapsed.push(survivor);
  }
  for (const game of withoutIgdb) { titleTargets.set(normalizeTitle(displayName(game.name)), game._id); collapsed.push(game); }
  return { games: collapsed, titleTargets, duplicateGroups, duplicateRecords };
}

function analyzeLegacy({ users = [], games = [] }) {
  const blockers = []; const warnings = [];
  const usernameGroups = new Map();
  for (const user of users) {
    const key = usernameKey(user.name);
    if (!key || displayName(user.name).length < 3 || displayName(user.name).length > 32) blockers.push({ code: 'invalid_legacy_username', userId: String(user._id), message: 'Legacy user name cannot satisfy v2 username rules' });
    else usernameGroups.set(key, [...(usernameGroups.get(key) || []), user]);
    if (!user.password || typeof user.password !== 'string') blockers.push({ code: 'missing_password_hash', userId: String(user._id), message: 'Legacy user has no reusable bcrypt password hash' });
    (user.games || []).forEach((game, index) => {
      if (!displayName(game.name) || !providerOf(game.platform)) warnings.push({ code: 'skipped_legacy_entitlement', userId: String(user._id), itemReference: String(index), message: 'Legacy game has an empty title or unsupported platform' });
    });
  }
  for (const [key, group] of usernameGroups) if (group.length > 1) blockers.push({ code: 'duplicate_username_normalized', username: key, userIds: group.map((user) => String(user._id)), message: 'Two legacy users collide after v2 username normalization' });
  const collapsed = collapseLegacyGames(games);
  if (collapsed.duplicateGroups) warnings.push({ code: 'duplicate_igdb_id_collapsed', groups: collapsed.duplicateGroups, records: collapsed.duplicateRecords, message: 'Duplicate legacy IGDB records will be collapsed into deterministic canonical survivors' });
  return { blockers, warnings, source: { users: users.length, games: games.length, canonicalGames: collapsed.games.length, entitlements: users.reduce((count, user) => count + (user.games || []).length, 0) } };
}

function legacyCanonical(game, now) {
  const title = displayName(game.name); const normalizedTitle = normalizeTitle(title);
  return {
    _id: game._id,
    igdbId: Number.isInteger(game.igdbId) ? game.igdbId : undefined,
    canonicalTitle: title,
    normalizedTitle,
    alternativeTitles: Array.isArray(game.alternativeTitles) ? game.alternativeTitles : [],
    summary: game.description || undefined,
    genres: Array.isArray(game.genres) ? game.genres.filter((item) => typeof item === 'string') : [],
    platforms: Array.isArray(game.availablePlatforms) ? game.availablePlatforms.filter((item) => typeof item === 'string') : [],
    gameModes: Array.isArray(game.gameModes) ? game.gameModes.filter((item) => typeof item === 'string') : [],
    rating: Number.isFinite(game.rating) ? game.rating : undefined,
    artwork: game.artwork || undefined,
    releaseDate: asDate(game.releaseDate, undefined),
    videos: Array.isArray(game.videos) ? game.videos.filter((item) => typeof item === 'string') : [],
    companies: Array.isArray(game.publishers) ? game.publishers.filter((item) => typeof item === 'string') : [],
    igdbUrl: game.igdbUrl || undefined,
    origin: 'provider_discovery', storeAvailability: 'store',
    metadata: { status: Number.isInteger(game.igdbId) ? 'complete' : 'pending', attempts: Number.isInteger(game.igdbId) ? 1 : 0, lastSyncAt: asDate(game.lastUpdated, now) },
    createdAt: asDate(game.createdAt, now), updatedAt: asDate(game.lastUpdated, now)
  };
}

async function migrateLegacy({ db, mode = 'dry-run', now = new Date() }) {
  if (!['dry-run', 'apply', 'verify'].includes(mode)) throw new Error('mode must be dry-run, apply, or verify');
  const [users, games] = await Promise.all([db.collection('users').find({}).toArray(), db.collection('games').find({}).toArray()]);
  const report = analyzeLegacy({ users, games });
  if (mode === 'dry-run') return { mode, ...report, ready: report.blockers.length === 0 };
  if (mode === 'verify') {
    const [v2Users, v2Games, v2Items] = await Promise.all([db.collection('users_v2').countDocuments(), db.collection('canonical_games_v2').countDocuments(), db.collection('library_items_v2').countDocuments({ removedAt: null })]);
    return { mode, ...report, target: { users: v2Users, games: v2Games, activeEntitlements: v2Items }, valid: !report.blockers.length && v2Users >= report.source.users && v2Items >= report.source.entitlements - report.warnings.filter((warning) => warning.code === 'skipped_legacy_entitlement').length };
  }
  if (report.blockers.length) { const error = new Error('Legacy migration has blocking data conflicts; run dry-run and resolve them first'); error.report = report; throw error; }

  const canonical = db.collection('canonical_games_v2'); const v2Users = db.collection('users_v2'); const items = db.collection('library_items_v2'); const aliases = db.collection('game_aliases_v2');
  const collapsedLegacy = collapseLegacyGames(games); const collapsedGames = collapsedLegacy.games;
  for (const game of collapsedGames) {
    const record = legacyCanonical(game, now);
    await canonical.updateOne({ _id: record._id }, { $setOnInsert: record }, { upsert: true });
  }
  for (const user of users) {
    const name = displayName(user.name); const userRecord = { _id: user._id, usernameNormalized: usernameKey(name), usernameDisplay: name, passwordHash: user.password, role: user.isAdmin ? 'admin' : 'member', steamAccount: user.steamId ? { steamId: String(user.steamId), linkedAt: asDate(user.createdAt, now) } : undefined, retroAchievements: user.retroAchievementsUsername ? { username: user.retroAchievementsUsername, userId: user.retroAchievementsULID || undefined, linkedAt: asDate(user.retroAchievementsLinkedAt, now) } : undefined, createdAt: asDate(user.createdAt, now), updatedAt: now };
    await v2Users.updateOne({ _id: user._id }, { $setOnInsert: userRecord }, { upsert: true });
    for (const [index, game] of (user.games || []).entries()) {
      const provider = providerOf(game.platform); const title = displayName(game.name); const normalizedTitle = normalizeTitle(title);
      if (!provider || !title || !normalizedTitle) continue;
      let target = collapsedLegacy.titleTargets.has(normalizedTitle) ? { _id: collapsedLegacy.titleTargets.get(normalizedTitle) } : await canonical.findOne({ normalizedTitle, archivedAt: null, hiddenAt: null, mergedIntoId: null }, { projection: { _id: 1 } });
      if (!target) { const record = { _id: new mongoose.Types.ObjectId(), canonicalTitle: title, normalizedTitle, alternativeTitles: [], genres: [], platforms: [], gameModes: [], videos: [], companies: [], origin: 'provider_discovery', storeAvailability: 'store', metadata: { status: 'pending', attempts: 0 }, createdAt: now, updatedAt: now }; await canonical.insertOne(record); target = record; }
      const providerGameId = game.platformId ? String(game.platformId) : `legacy:${user._id}:${index}`;
      const entitlement = { userId: user._id, provider, providerGameId, providerTitle: title, normalizedTitle, canonicalGameId: target._id, matchStatus: 'auto_matched', matchConfidence: 1, matchMethod: 'legacy_title_migration', source: 'migration', firstSeenAt: asDate(user.createdAt, now), lastSeenAt: now, removedAt: null, createdAt: now, updatedAt: now };
      await items.updateOne({ userId: user._id, provider, providerGameId, removedAt: null }, { $setOnInsert: entitlement }, { upsert: true });
      await aliases.updateOne({ provider, providerGameId }, { $setOnInsert: { provider, providerGameId, normalizedProviderTitle: normalizedTitle, canonicalGameId: target._id, matchType: 'provider_id', confidence: 1, createdAt: now, updatedAt: now } }, { upsert: true });
    }
  }
  const verification = await migrateLegacy({ db, mode: 'verify', now });
  return { mode, ...report, verification, applied: true };
}

module.exports = { analyzeLegacy, migrateLegacy };