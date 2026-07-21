const express = require('express');
const { requireAuth } = require('../http/auth');
const { AppError } = require('../http/errors');
const { exactKeys, object, string } = require('../http/validate');
const { createRetroAchievementsClient, RetroAchievementsProviderError } = require('../providers/retroAchievementsClient');
const RetroChallenge = require('../models/RetroChallenge');
const { requireRole } = require('../http/auth');

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,32}$/;

function publicProfile(profile, username) {
  return {
    username: profile?.user || profile?.username || username,
    displayName: profile?.user || profile?.username || username,
    avatarUrl: profile?.userPic || profile?.avatarUrl || null,
    points: Number.isFinite(profile?.totalPoints) ? profile.totalPoints : (Number.isFinite(profile?.points) ? profile.points : null),
    pointsSoftcore: Number.isFinite(profile?.totalSoftcorePoints) ? profile.totalSoftcorePoints : null,
    memberSince: profile?.memberSince || null
  };
}

function publicChallenge(challenge, progress) {
  return { id: challenge._id.toString(), retroGameId: challenge.retroGameId, title: challenge.title, consoleName: challenge.consoleName, imageUrl: challenge.imageUrl, description: challenge.description, active: challenge.active, progress: progress ? { earned: Number(progress.numAwardedToUser ?? progress.numAchievementsEarned ?? 0), total: Number(progress.numAchievements ?? progress.totalAchievements ?? 0), points: Number(progress.pointsEarned ?? progress.userPoints ?? 0) } : null };
}

function createRetroRouter(config, { retroClient } = {}) {
  const router = express.Router();
  const client = retroClient || (() => createRetroAchievementsClient({ username: config.providers.retroAchievementsUsername, apiKey: config.providers.retroAchievementsApiKey }));
  router.put('/me/retroachievements', requireAuth(config), async (req, res, next) => {
    try {
      object(req.body); exactKeys(req.body, ['username']);
      const username = string(req.body.username, 'username', { min: 3, max: 32 });
      if (!USERNAME_PATTERN.test(username)) throw new AppError(400, 'invalid_request', 'username contains unsupported characters');
      req.user.retroAchievements = { username, linkedAt: new Date() };
      await req.user.save();
      res.json({ retroAchievements: { username, linkedAt: req.user.retroAchievements.linkedAt } });
    } catch (error) { next(error); }
  });
  router.get('/me/retroachievements/profile', requireAuth(config), async (req, res, next) => {
    try {
      const username = req.user.retroAchievements?.username;
      if (!username) throw new AppError(409, 'retroachievements_not_linked', 'Link a RetroAchievements account before requesting a profile');
      const profile = await (typeof client === 'function' ? client() : client).getProfile(username);
      res.json({ profile: publicProfile(profile, username) });
    } catch (error) {
      next(error instanceof AppError ? error : new AppError(502, 'retroachievements_unavailable', error instanceof RetroAchievementsProviderError ? error.message : 'RetroAchievements profile request failed'));
    }
  });
  router.get('/retroachievements/challenge', requireAuth(config), async (req, res, next) => {
    try {
      const challenge = await RetroChallenge.findOne({ active: true });
      if (!challenge) return res.json({ challenge: null });
      const username = req.user.retroAchievements?.username;
      const progress = username ? await (typeof client === 'function' ? client() : client).getGameProgress(challenge.retroGameId, username) : null;
      res.json({ challenge: publicChallenge(challenge, progress) });
    } catch (error) { next(new AppError(502, 'retroachievements_unavailable', error instanceof RetroAchievementsProviderError ? error.message : 'RetroAchievements challenge request failed')); }
  });
  router.put('/admin/retroachievements/challenge', requireAuth(config), requireRole('admin'), async (req, res, next) => {
    try {
      object(req.body); exactKeys(req.body, ['retroGameId', 'description']);
      const retroGameId = Number(req.body.retroGameId);
      if (!Number.isInteger(retroGameId) || retroGameId < 1) throw new AppError(400, 'invalid_request', 'retroGameId must be a positive integer');
      const description = req.body.description === undefined ? '' : string(req.body.description, 'description', { max: 2000 });
      const game = await (typeof client === 'function' ? client() : client).getGame(retroGameId);
      if (!game?.title) throw new AppError(502, 'retroachievements_unavailable', 'RetroAchievements returned no game title');
      await RetroChallenge.updateMany({ active: true }, { $set: { active: false } });
      const challenge = await RetroChallenge.findOneAndUpdate({ retroGameId }, { $set: { title: game.title, consoleName: game.consoleName || '', imageUrl: game.imageBoxArt || game.imageIcon || null, description, active: true, activatedBy: req.user._id } }, { new: true, upsert: true, setDefaultsOnInsert: true });
      res.json({ challenge: publicChallenge(challenge, null) });
    } catch (error) { next(error); }
  });
  return router;
}

module.exports = { createRetroRouter };