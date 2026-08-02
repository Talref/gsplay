const mongoose = require('mongoose');
const CanonicalGame = require('../../models/CanonicalGame');
const LibraryItem = require('../../models/LibraryItem');
const { requireAuth } = require('../../http/auth');
const { AppError } = require('../../http/errors');
const { exactKeys, object, string } = require('../../http/validate');
const { asPage, libraryGameDto } = require('./common');

function registerMemberLibraryRoutes(router, config) {
  router.get('/me/library', requireAuth(config), async (req, res, next) => {
    try {
      const page = asPage(req.query.page, 1, 10_000);
      const pageSize = asPage(req.query.pageSize, 30, 100);
      const filter = { userId: req.user._id, removedAt: null };
      if (req.query.provider) filter.provider = string(req.query.provider, 'provider', { max: 32 });

      // Entitlements remain the source of truth; this read model groups only
      // records that have already been matched to one canonical game.
      const [result] = await LibraryItem.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $ifNull: ['$canonicalGameId', '$_id'] },
            canonicalGameId: { $first: '$canonicalGameId' },
            providerTitle: { $min: '$providerTitle' },
            providers: { $addToSet: '$provider' },
            entitlementCount: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'canonical_games_v2',
            localField: 'canonicalGameId',
            foreignField: '_id',
            as: 'canonicalGame'
          }
        },
        { $unwind: { path: '$canonicalGame', preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $or: [
              { canonicalGame: null },
              {
                'canonicalGame.hiddenAt': null,
                'canonicalGame.archivedAt': null,
                'canonicalGame.mergedIntoId': null
              }
            ]
          }
        },
        {
          $addFields: {
            sortTitle: { $ifNull: ['$canonicalGame.canonicalTitle', '$providerTitle'] }
          }
        },
        { $sort: { sortTitle: 1, _id: 1 } },
        {
          $facet: {
            items: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }],
            total: [{ $count: 'value' }]
          }
        }
      ]);
      res.json({
        items: result.items.map(libraryGameDto),
        page: { number: page, size: pageSize, total: result.total[0]?.value || 0 }
      });
    } catch (error) {
      next(error);
    }
  });

  router.put('/me/library/games/:gameId', requireAuth(config), async (req, res, next) => {
    try {
      if (!mongoose.isObjectIdOrHexString(req.params.gameId))
        throw new AppError(400, 'invalid_request', 'gameId must be valid');
      const game = await CanonicalGame.findOne({
        _id: req.params.gameId,
        hiddenAt: null,
        archivedAt: null,
        mergedIntoId: null
      });
      if (!game) throw new AppError(404, 'not_found', 'Game was not found');
      const imported = await LibraryItem.findOne({
        userId: req.user._id,
        canonicalGameId: game._id,
        provider: { $ne: 'manual' },
        removedAt: null
      });
      if (imported)
        return res.json({
          ownership: { owned: true, manual: false, providers: [imported.provider] },
          created: false
        });
      const manual = await LibraryItem.findOne({
        userId: req.user._id,
        provider: 'manual',
        providerGameId: game._id.toString()
      });
      if (manual) {
        manual.removedAt = null;
        manual.lastSeenAt = new Date();
        await manual.save();
        return res.json({
          ownership: { owned: true, manual: true, providers: ['manual'] },
          created: false
        });
      }
      await LibraryItem.create({
        userId: req.user._id,
        provider: 'manual',
        providerGameId: game._id.toString(),
        providerTitle: game.canonicalTitle,
        normalizedTitle: game.normalizedTitle,
        canonicalGameId: game._id,
        matchStatus: 'manually_matched',
        matchConfidence: 1,
        matchMethod: 'user_catalogue_claim',
        source: 'manual'
      });
      res
        .status(201)
        .json({ ownership: { owned: true, manual: true, providers: ['manual'] }, created: true });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/me/library/games/:gameId', requireAuth(config), async (req, res, next) => {
    try {
      if (!mongoose.isObjectIdOrHexString(req.params.gameId))
        throw new AppError(400, 'invalid_request', 'gameId must be valid');
      const body = object(req.body || {});
      exactKeys(body, ['confirmation']);
      if (body.confirmation !== 'REMOVE FROM LIBRARY')
        throw new AppError(400, 'invalid_request', 'REMOVE FROM LIBRARY confirmation is required');
      const item = await LibraryItem.findOne({
        userId: req.user._id,
        provider: 'manual',
        providerGameId: req.params.gameId,
        removedAt: null
      });
      if (!item)
        throw new AppError(
          409,
          'manual_entitlement_not_found',
          'Only games added manually can be removed here; imported ownership is managed by its provider sync'
        );
      item.removedAt = new Date();
      await item.save();
      const providers = await LibraryItem.distinct('provider', {
        userId: req.user._id,
        canonicalGameId: item.canonicalGameId,
        removedAt: null
      });
      res.json({ ownership: { owned: providers.length > 0, manual: false, providers } });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = { registerMemberLibraryRoutes };
