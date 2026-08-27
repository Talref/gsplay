const RetroChallenge = require('../models/RetroChallenge');
const RetroProgress = require('../models/RetroChallengeProgress');
const User = require('../models/User');
const { AppError } = require('../http/errors');
const { zonedDateTimeToUtc, zonedParts } = require('./casualFriday/scheduling');

const TIME_ZONE = 'Europe/Rome';

function monthWindow(now = new Date()) {
  const local = zonedParts(now, TIME_ZONE);
  const nextMonth = local.month === 12 ? { year: local.year + 1, month: 1 } : { year: local.year, month: local.month + 1 };
  return {
    monthKey: `${local.year}-${String(local.month).padStart(2, '0')}`,
    startsAt: zonedDateTimeToUtc({ year: local.year, month: local.month, day: 1 }, TIME_ZONE),
    endsAt: zonedDateTimeToUtc({ ...nextMonth, day: 1 }, TIME_ZONE)
  };
}

function previousMonthKey(now = new Date()) {
  const local = zonedParts(now, TIME_ZONE);
  const date = new Date(Date.UTC(local.year, local.month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function absoluteRaUrl(value) {
  if (!value) return null;
  return /^https:\/\//.test(value) ? value : `https://retroachievements.org${value}`;
}

function gameIdFromInput(value) {
  const text = String(value || '').trim();
  if (/^\d+$/.test(text)) return Number(text);
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new AppError(400, 'invalid_request', 'Use a RetroAchievements game URL or numeric game ID');
  }
  if (!/(^|\.)retroachievements\.org$/i.test(url.hostname) || url.username || url.password)
    throw new AppError(400, 'invalid_request', 'Use a RetroAchievements game URL');
  const match = url.pathname.match(/^\/game\/(\d+)\/?$/i);
  if (!match) throw new AppError(400, 'invalid_request', 'RetroAchievements game URL is invalid');
  return Number(match[1]);
}

function achievementDefinitions(game) {
  return Object.values(game?.achievements || {})
    .map((achievement) => ({
      achievementId: Number(achievement.id),
      badgeId: achievement.badgeName,
      title: achievement.title,
      description: achievement.description || '',
      points: Number(achievement.points) || 0,
      displayOrder: Number(achievement.displayOrder) || 0
    }))
    .filter((achievement) => Number.isInteger(achievement.achievementId) && achievement.badgeId)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.achievementId - b.achievementId);
}

async function previewGame(input, client) {
  const retroGameId = gameIdFromInput(input);
  const game = await client.getGame(retroGameId);
  if (!game?.title)
    throw new AppError(502, 'retroachievements_unavailable', 'RetroAchievements returned no game title');
  return {
    retroGameId,
    title: game.title,
    consoleName: game.consoleName || '',
    imageUrl: absoluteRaUrl(game.imageBoxArt || game.imageTitle || game.imageIcon || null),
    achievementCount: achievementDefinitions(game).length
  };
}

async function challengeProgress(challenge) {
  return RetroProgress.find({ challengeId: challenge._id, unlockedCount: { $gt: 0 } }).lean();
}

function ranking(progress) {
  return [...progress].sort(
    (a, b) =>
      b.score - a.score ||
      b.completionPercentage - a.completionPercentage ||
      b.hardcoreCount - a.hardcoreCount ||
      a.usernameSnapshot.localeCompare(b.usernameSnapshot)
  );
}

async function challengeDto(challenge, { includeAchievements = true } = {}) {
  if (!challenge) return null;
  const progress = await challengeProgress(challenge);
  const ranked = ranking(progress);
  const ownerCounts = new Map();
  progress.forEach((entry) =>
    entry.unlocks.forEach((unlock) =>
      ownerCounts.set(unlock.achievementId, (ownerCounts.get(unlock.achievementId) || 0) + 1)
    )
  );
  const achievements = includeAchievements
    ? (challenge.achievements || []).map((achievement) => ({
        achievementId: achievement.achievementId,
        badgeUrl: absoluteRaUrl(`/Badge/${achievement.badgeId}.png`),
        title: achievement.title,
        description: achievement.description,
        points: achievement.points,
        displayOrder: achievement.displayOrder,
        playerCount: ownerCounts.get(achievement.achievementId) || 0
      }))
    : undefined;
  let previous;
  let displayedRank = 0;
  const leaderboard = ranked.map((entry, index) => {
    if (
      !previous ||
      entry.score !== previous.score ||
      entry.completionPercentage !== previous.completionPercentage ||
      entry.hardcoreCount !== previous.hardcoreCount
    )
      displayedRank = index + 1;
    previous = entry;
    return {
    rank: displayedRank,
    userId: String(entry.userId),
    username: entry.usernameSnapshot,
    retroUsername: entry.retroUsernameSnapshot,
    score: entry.score,
    completionPercentage: entry.completionPercentage,
    unlockedCount: entry.unlockedCount,
    hardcoreCount: entry.hardcoreCount,
    achievementIds: entry.unlocks.map((unlock) => unlock.achievementId)
  };
  });
  const totalUnlocks = progress.reduce((sum, entry) => sum + entry.unlockedCount, 0);
  const totalPoints = progress.reduce((sum, entry) => sum + entry.score, 0);
  const averageCompletion = progress.length
    ? Math.round((progress.reduce((sum, entry) => sum + entry.completionPercentage, 0) / progress.length) * 100) / 100
    : 0;
  const top = ranked[0];
  const winners = top
    ? ranked.filter(
        (entry) =>
          entry.score === top.score &&
          entry.completionPercentage === top.completionPercentage &&
          entry.hardcoreCount === top.hardcoreCount
      )
    : [];
  return {
    id: String(challenge._id),
    retroGameId: challenge.retroGameId,
    monthKey: challenge.monthKey,
    sequence: challenge.sequence,
    version: challenge.version,
    status: challenge.status || (challenge.active ? 'active' : 'completed'),
    title: challenge.title,
    consoleName: challenge.consoleName,
    imageUrl: absoluteRaUrl(challenge.imageUrl),
    description: challenge.description || '',
    scoringStartsAt: challenge.scoringStartsAt,
    scoringEndsAt: challenge.scoringEndsAt,
    lastRefreshAt: challenge.lastRefreshAt,
    cancelledAt: challenge.cancelledAt,
    cancellationReason: challenge.cancellationReason,
    achievements,
    leaderboard,
    summary: {
      participants: progress.length,
      totalUnlocks,
      totalPoints,
      averageCompletion,
      winners: winners.map((entry) => ({ username: entry.usernameSnapshot, score: entry.score, completionPercentage: entry.completionPercentage }))
    }
  };
}

async function activateChallenge(actor, input, description, client, now = new Date()) {
  const window = monthWindow(now);
  if (await RetroChallenge.exists({ active: true }))
    throw new AppError(409, 'retro_challenge_active', 'Cancel the active Retroclub edition before starting another');
  const retroGameId = gameIdFromInput(input);
  const game = await client.getGame(retroGameId);
  if (!game?.title) throw new AppError(502, 'retroachievements_unavailable', 'RetroAchievements returned no game title');
  const last = await RetroChallenge.findOne({ monthKey: window.monthKey }).sort({ sequence: -1 }).select('sequence');
  const challenge = await RetroChallenge.create({
    retroGameId,
    monthKey: window.monthKey,
    sequence: (last?.sequence || 0) + 1,
    status: 'active',
    active: true,
    title: game.title,
    consoleName: game.consoleName || '',
    imageUrl: game.imageBoxArt || game.imageTitle || game.imageIcon || null,
    description,
    achievements: achievementDefinitions(game),
    scoringStartsAt: window.startsAt,
    scoringEndsAt: window.endsAt,
    activatedBy: actor._id,
    activatedAt: now,
    updatedBy: actor._id
  });
  return challengeDto(challenge);
}

async function updateDescription(actor, id, version, description) {
  const challenge = await RetroChallenge.findOneAndUpdate(
    { _id: id, version, status: { $ne: 'cancelled' } },
    { $set: { description, updatedBy: actor._id }, $inc: { version: 1 } },
    { new: true, runValidators: true }
  );
  if (!challenge) throw new AppError(409, 'retro_challenge_changed', 'This Retroclub edition changed. Reload it.');
  return challengeDto(challenge);
}

async function cancelChallenge(actor, id, version, reason, now = new Date()) {
  const challenge = await RetroChallenge.findOneAndUpdate(
    { _id: id, version, status: 'active', active: true },
    {
      $set: { status: 'cancelled', active: false, cancelledBy: actor._id, cancelledAt: now, cancellationReason: reason, updatedBy: actor._id },
      $inc: { version: 1 }
    },
    { new: true, runValidators: true }
  );
  if (!challenge) throw new AppError(409, 'retro_challenge_not_cancellable', 'Only the active Retroclub edition can be cancelled');
  return challengeDto(challenge);
}

async function refreshChallenge(challenge, client, now = new Date()) {
  if (!challenge.achievements?.length) {
    const game = await client.getGame(challenge.retroGameId);
    const achievements = achievementDefinitions(game);
    if (!achievements.length)
      throw new AppError(
        502,
        'retroachievements_unavailable',
        'RetroAchievements returned no core achievements for this game'
      );
    challenge.title = game.title || challenge.title;
    challenge.consoleName = game.consoleName || challenge.consoleName;
    challenge.imageUrl = game.imageBoxArt || game.imageTitle || game.imageIcon || challenge.imageUrl;
    challenge.achievements = achievements;
  }
  const users = await User.find({ 'retroAchievements.username': { $exists: true, $ne: '' } }).select('usernameDisplay retroAchievements');
  const definitionMap = new Map((challenge.achievements || []).map((item) => [item.achievementId, item]));
  let refreshed = 0;
  let failed = 0;
  for (const user of users) {
    try {
      const earned = await client.getAchievementsBetween(
        user.retroAchievements.username,
        challenge.scoringStartsAt,
        new Date(Math.min(now.getTime(), challenge.scoringEndsAt.getTime()))
      );
      const unique = new Map();
      earned
        .filter((item) => Number(item.gameId) === challenge.retroGameId && definitionMap.has(Number(item.achievementId)))
        .forEach((item) => {
          const id = Number(item.achievementId);
          const prior = unique.get(id);
          if (!prior || item.hardcoreMode) unique.set(id, { achievementId: id, earnedAt: new Date(item.date.replace(' ', 'T') + 'Z'), hardcore: Boolean(item.hardcoreMode), points: definitionMap.get(id).points });
        });
      const unlocks = [...unique.values()];
      const score = unlocks.reduce((sum, item) => sum + item.points, 0);
      await RetroProgress.findOneAndUpdate(
        { challengeId: challenge._id, userId: user._id },
        {
          $set: {
            usernameSnapshot: user.usernameDisplay,
            retroUsernameSnapshot: user.retroAchievements.username,
            score,
            completionPercentage: challenge.achievements.length ? Math.round((unlocks.length / challenge.achievements.length) * 10_000) / 100 : 0,
            unlockedCount: unlocks.length,
            hardcoreCount: unlocks.filter((item) => item.hardcore).length,
            unlocks,
            lastRefreshedAt: now
          },
          $unset: { lastError: 1 }
        },
        { upsert: true, runValidators: true }
      );
      refreshed += 1;
    } catch (error) {
      failed += 1;
      await RetroProgress.updateOne(
        { challengeId: challenge._id, userId: user._id },
        { $set: { lastError: error.message } }
      );
    }
  }
  challenge.lastRefreshAt = now;
  challenge.refreshSummary = { linked: users.length, refreshed, failed };
  if (now >= challenge.scoringEndsAt) {
    challenge.status = 'completed';
    challenge.active = false;
    challenge.completedAt = now;
  }
  challenge.version += 1;
  await challenge.save();
  return { linked: users.length, refreshed, failed, completed: challenge.status === 'completed' };
}

async function refreshActiveChallenge({ client, now = new Date() }) {
  const challenge = await RetroChallenge.findOne({ active: true, status: 'active' });
  if (!challenge) return { active: false };
  return { active: true, ...(await refreshChallenge(challenge, client, now)) };
}

async function publicRetroclub(now = new Date()) {
  const [active, lastMonth] = await Promise.all([
    RetroChallenge.findOne({ active: true, status: 'active' }),
    RetroChallenge.findOne({ monthKey: previousMonthKey(now), status: 'completed' }).sort({ sequence: -1 })
  ]);
  return {
    active: await challengeDto(active),
    lastMonth: await challengeDto(lastMonth, { includeAchievements: false })
  };
}

async function pastEditions(page = 1, pageSize = 6) {
  const filter = { status: 'completed' };
  const [items, total] = await Promise.all([
    RetroChallenge.find(filter).sort({ monthKey: -1, sequence: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    RetroChallenge.countDocuments(filter)
  ]);
  return { editions: await Promise.all(items.map((item) => challengeDto(item, { includeAchievements: false }))), page, pageSize, total, hasMore: page * pageSize < total };
}

async function adminOverview() {
  const [totalUsers, linkedAccounts, active, recent] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ 'retroAchievements.username': { $exists: true, $ne: '' } }),
    RetroChallenge.findOne({ active: true, status: 'active' }),
    RetroChallenge.find().sort({ createdAt: -1 }).limit(12)
  ]);
  return { accounts: { linked: linkedAccounts, total: totalUsers }, active: await challengeDto(active), editions: await Promise.all(recent.map((item) => challengeDto(item, { includeAchievements: false }))) };
}

module.exports = {
  activateChallenge,
  adminOverview,
  cancelChallenge,
  challengeDto,
  gameIdFromInput,
  monthWindow,
  pastEditions,
  previewGame,
  publicRetroclub,
  refreshActiveChallenge,
  refreshChallenge,
  updateDescription
};
