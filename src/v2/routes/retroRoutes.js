const express = require('express');
const { requireAuth, requireRole } = require('../http/auth');
const { AppError } = require('../http/errors');
const { exactKeys, object, string } = require('../http/validate');
const {
  createRetroAchievementsClient,
  RetroAchievementsProviderError
} = require('../providers/retroAchievementsClient');
const {
  activateChallenge,
  adminOverview,
  cancelChallenge,
  pastEditions,
  previewGame,
  publicRetroclub,
  refreshChallenge,
  updateDescription
} = require('../services/retroService');
const RetroChallenge = require('../models/RetroChallenge');

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,32}$/;

function providerFailure(error, fallback) {
  return error instanceof AppError
    ? error
    : new AppError(
        502,
        'retroachievements_unavailable',
        error instanceof RetroAchievementsProviderError ? error.message : fallback
      );
}

function profileDto(profile, fallback) {
  return {
    userId: String(profile?.ID ?? profile?.id ?? ''),
    username: profile?.User || profile?.user || profile?.username || fallback,
    avatarUrl: profile?.UserPic || profile?.userPic || profile?.avatarUrl || null,
    points: Number(profile?.TotalPoints ?? profile?.totalPoints ?? profile?.points) || 0,
    memberSince: profile?.MemberSince || profile?.memberSince || null
  };
}

function positiveInteger(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new AppError(400, 'invalid_request', `${field} must be a positive integer`);
  return parsed;
}

function createRetroRouter(config, { retroClient } = {}) {
  const router = express.Router();
  const getClient = () =>
    retroClient ||
    createRetroAchievementsClient({
      username: config.providers.retroAchievementsUsername,
      apiKey: config.providers.retroAchievementsApiKey
    });
  const authenticated = requireAuth(config);
  const admin = [authenticated, requireRole('admin')];

  router.put('/me/retroachievements', authenticated, async (req, res, next) => {
    try {
      object(req.body);
      exactKeys(req.body, ['username']);
      const requested = string(req.body.username, 'username', { min: 3, max: 32 });
      if (!USERNAME_PATTERN.test(requested))
        throw new AppError(400, 'invalid_request', 'username contains unsupported characters');
      const profile = profileDto(await getClient().getProfile(requested), requested);
      if (!profile.userId)
        throw new AppError(502, 'retroachievements_unavailable', 'RetroAchievements returned no account ID');
      const linkedElsewhere = await req.user.constructor.exists({
        _id: { $ne: req.user._id },
        'retroAchievements.userId': profile.userId
      });
      if (linkedElsewhere)
        throw new AppError(409, 'retroachievements_already_linked', 'That RetroAchievements account is already linked');
      req.user.retroAchievements = {
        username: profile.username,
        userId: profile.userId,
        linkedAt: new Date()
      };
      await req.user.save();
      res.json({ retroAchievements: req.user.toPublic().retroAchievements, profile });
    } catch (error) {
      next(providerFailure(error, 'RetroAchievements profile request failed'));
    }
  });

  router.delete('/me/retroachievements', authenticated, async (req, res, next) => {
    try {
      object(req.body);
      exactKeys(req.body, ['confirmation']);
      if (req.body.confirmation !== 'UNLINK RETROACHIEVEMENTS')
        throw new AppError(400, 'confirmation_required', 'Account unlink confirmation is required');
      req.user.retroAchievements = undefined;
      await req.user.save();
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get('/me/retroachievements/profile', authenticated, async (req, res, next) => {
    try {
      const username = req.user.retroAchievements?.username;
      if (!username)
        throw new AppError(409, 'retroachievements_not_linked', 'Link a RetroAchievements account first');
      res.json({ profile: profileDto(await getClient().getProfile(username), username) });
    } catch (error) {
      next(providerFailure(error, 'RetroAchievements profile request failed'));
    }
  });

  router.get('/retroachievements', authenticated, async (req, res, next) => {
    try {
      res.json(await publicRetroclub());
    } catch (error) {
      next(error);
    }
  });

  router.get('/retroachievements/editions', authenticated, async (req, res, next) => {
    try {
      res.json(await pastEditions(positiveInteger(req.query.page || 1, 'page')));
    } catch (error) {
      next(error);
    }
  });

  router.get('/retroachievements/challenge', authenticated, async (req, res, next) => {
    try {
      res.json({ challenge: (await publicRetroclub()).active });
    } catch (error) {
      next(error);
    }
  });

  router.get('/admin/retroachievements', ...admin, async (req, res, next) => {
    try {
      res.json(await adminOverview());
    } catch (error) {
      next(error);
    }
  });

  router.post('/admin/retroachievements/preview', ...admin, async (req, res, next) => {
    try {
      object(req.body);
      exactKeys(req.body, ['game']);
      res.json({ game: await previewGame(string(req.body.game, 'game', { max: 512 }), getClient()) });
    } catch (error) {
      next(providerFailure(error, 'RetroAchievements game request failed'));
    }
  });

  router.post('/admin/retroachievements/challenges', ...admin, async (req, res, next) => {
    try {
      object(req.body);
      exactKeys(req.body, ['game', 'description']);
      const game = string(req.body.game, 'game', { max: 512 });
      const description = string(req.body.description, 'description', { min: 0, max: 2000 });
      res.status(201).json({ challenge: await activateChallenge(req.user, game, description, getClient()) });
    } catch (error) {
      next(providerFailure(error, 'RetroAchievements game request failed'));
    }
  });

  router.put('/admin/retroachievements/challenges/:id/description', ...admin, async (req, res, next) => {
    try {
      object(req.body);
      exactKeys(req.body, ['version', 'description']);
      res.json({ challenge: await updateDescription(req.user, req.params.id, positiveInteger(req.body.version, 'version'), string(req.body.description, 'description', { min: 0, max: 2000 })) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/admin/retroachievements/challenges/:id/cancel', ...admin, async (req, res, next) => {
    try {
      object(req.body);
      exactKeys(req.body, ['version', 'reason']);
      res.json({ challenge: await cancelChallenge(req.user, req.params.id, positiveInteger(req.body.version, 'version'), string(req.body.reason, 'reason', { max: 1000 })) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/admin/retroachievements/challenges/:id/refresh', ...admin, async (req, res, next) => {
    try {
      const challenge = await RetroChallenge.findOne({ _id: req.params.id, status: 'active', active: true });
      if (!challenge) throw new AppError(404, 'retro_challenge_not_found', 'Active Retroclub edition not found');
      res.json({ refresh: await refreshChallenge(challenge, getClient()) });
    } catch (error) {
      next(providerFailure(error, 'RetroAchievements refresh failed'));
    }
  });

  return router;
}

module.exports = { createRetroRouter };
