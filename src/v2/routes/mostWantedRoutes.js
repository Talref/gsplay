const express = require('express');
const { requireAuth } = require('../http/auth');
const MostWantedSnapshot = require('../models/MostWantedSnapshot');

const pageOf = (value, fallback, maximum) =>
  Math.min(Math.max(Number.parseInt(value || fallback, 10) || fallback, 1), maximum);

function createMostWantedRouter(config) {
  const router = express.Router();
  router.get('/most-wanted', requireAuth(config), async (req, res, next) => {
    try {
      const page = pageOf(req.query.page, 1, 10_000);
      const pageSize = pageOf(req.query.pageSize, 24, 48);
      const skip = (page - 1) * pageSize;
      const [snapshot] = await MostWantedSnapshot.aggregate([
        { $match: { key: 'current' } },
        {
          $project: {
            generatedAt: 1,
            lastAttemptAt: 1,
            lastError: 1,
            profilesEligible: 1,
            profilesIncluded: 1,
            profilesUnavailable: 1,
            profilesCached: 1,
            unmatchedAppCount: 1,
            total: { $size: '$games' },
            games: { $slice: ['$games', skip, pageSize] }
          }
        }
      ]);
      const available = Boolean(snapshot?.generatedAt);
      const failedSinceGeneration = Boolean(
        available &&
          snapshot.lastError?.code &&
          snapshot.lastAttemptAt &&
          snapshot.lastAttemptAt > snapshot.generatedAt
      );
      const stale = Boolean(
        available &&
          (snapshot.profilesCached > 0 ||
            failedSinceGeneration ||
            Date.now() - snapshot.generatedAt.getTime() > config.mostWanted.staleAfterMs)
      );
      const total = available ? snapshot.total : 0;
      res.json({
        available,
        stale,
        generatedAt: available ? snapshot.generatedAt : null,
        coverage: {
          included: snapshot?.profilesIncluded || 0,
          eligible: snapshot?.profilesEligible || 0,
          unavailable:
            snapshot?.profilesUnavailable ?? (available ? 0 : snapshot?.profilesEligible || 0),
          cached: snapshot?.profilesCached || 0
        },
        games: available
          ? snapshot.games.map((game, index) => ({
              id: game.canonicalGameId.toString(),
              rank: skip + index + 1,
              title: game.title,
              artwork: game.artwork,
              wishlistCount: game.wishlistCount,
              ownerCount: game.ownerCount,
              wishlistedBy: game.wishlistedBy.map((user) => ({
                id: user.userId.toString(),
                username: user.username
              })),
              ownedBy: game.ownedBy.map((user) => ({
                id: user.userId.toString(),
                username: user.username
              }))
            }))
          : [],
        page: {
          number: page,
          size: pageSize,
          total,
          hasMore: page * pageSize < total
        }
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

module.exports = { createMostWantedRouter };
