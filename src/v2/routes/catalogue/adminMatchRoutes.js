const mongoose = require('mongoose');
const CanonicalGame = require('../../models/CanonicalGame');
const LibraryItem = require('../../models/LibraryItem');
const GameAlias = require('../../models/GameAlias');
const { requireAuth, requireRole } = require('../../http/auth');
const { AppError } = require('../../http/errors');
const { pageOf } = require('./common');

function registerMatchReviewRoute(router, config) {
  router.get(
    '/admin/matches/review',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const items = await LibraryItem.find({ matchStatus: 'ambiguous', removedAt: null })
          .populate('userId', 'usernameDisplay')
          .limit(pageOf(req.query.limit, 50, 100));
        res.json({
          matches: items.map((item) => ({
            id: item._id.toString(),
            provider: item.provider,
            providerTitle: item.providerTitle,
            user: { id: item.userId._id.toString(), username: item.userId.usernameDisplay }
          }))
        });
      } catch (error) {
        next(error);
      }
    }
  );
}

function registerMatchResolutionRoute(router, config) {
  router.put(
    '/admin/matches/:id',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const { canonicalGameId } = req.body || {};
        if (
          !mongoose.isObjectIdOrHexString(req.params.id) ||
          !mongoose.isObjectIdOrHexString(canonicalGameId)
        )
          throw new AppError(
            400,
            'invalid_request',
            'A valid match and canonical game ID are required'
          );
        if (!(await CanonicalGame.exists({ _id: canonicalGameId })))
          throw new AppError(404, 'not_found', 'Canonical game was not found');
        const item = await LibraryItem.findOneAndUpdate(
          { _id: req.params.id, matchStatus: 'ambiguous' },
          {
            $set: {
              canonicalGameId,
              matchStatus: 'manually_matched',
              matchConfidence: 1,
              matchMethod: 'admin_review'
            }
          },
          { new: true }
        );
        if (!item) throw new AppError(404, 'not_found', 'Ambiguous match was not found');
        await GameAlias.updateOne(
          { provider: item.provider, providerGameId: item.providerGameId },
          {
            $set: {
              normalizedProviderTitle: item.normalizedTitle,
              canonicalGameId,
              matchType: 'manual',
              confidence: 1,
              reviewedBy: req.user._id,
              reviewedAt: new Date()
            }
          },
          { upsert: true }
        );
        res.json({ match: { id: item._id.toString(), matchStatus: item.matchStatus } });
      } catch (error) {
        next(error);
      }
    }
  );
}

module.exports = { registerMatchResolutionRoute, registerMatchReviewRoute };
