const mongoose = require('mongoose');
const CanonicalGame = require('../../models/CanonicalGame');
const LibraryItem = require('../../models/LibraryItem');
const { requireAuth } = require('../../http/auth');
const { AppError } = require('../../http/errors');
const { escapeRegex, gameDto, ownershipByGame, pageOf, queryValues } = require('./common');

function registerPublicCatalogueRoutes(router, config) {
  router.get('/community/games/top', async (req, res, next) => {
    try {
      const limit = pageOf(req.query.limit, 20, 20);
      const rows = await LibraryItem.aggregate([
        { $match: { removedAt: null, canonicalGameId: { $ne: null } } },
        {
          $group: {
            _id: { gameId: '$canonicalGameId', userId: '$userId' },
            providers: { $addToSet: '$provider' }
          }
        },
        {
          $group: {
            _id: '$_id.gameId',
            owners: { $push: { userId: '$_id.userId', providers: '$providers' } },
            ownerCount: { $sum: 1 }
          }
        },
        { $sort: { ownerCount: -1, _id: 1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'canonical_games_v2',
            localField: '_id',
            foreignField: '_id',
            as: 'game'
          }
        },
        { $unwind: '$game' },
        { $match: { 'game.hiddenAt': null, 'game.archivedAt': null, 'game.mergedIntoId': null } },
        {
          $lookup: {
            from: 'users_v2',
            localField: 'owners.userId',
            foreignField: '_id',
            as: 'users'
          }
        }
      ]);
      res.json({
        games: rows.map((row, index) => ({
          id: row._id.toString(),
          rank: index + 1,
          title: row.game.canonicalTitle,
          artwork: row.game.artwork,
          ownerCount: row.ownerCount,
          owners: row.owners.map((owner) => ({
            username:
              row.users.find((user) => user._id.equals(owner.userId))?.usernameDisplay || 'Unknown',
            providers: owner.providers
          }))
        }))
      });
    } catch (error) {
      next(error);
    }
  });
  router.get('/games', requireAuth(config), async (req, res, next) => {
    try {
      const page = pageOf(req.query.page, 1, 10_000);
      const pageSize = pageOf(req.query.pageSize, 30, 100);
      const sort = ['rating', 'name', 'owners'].includes(req.query.sort)
        ? req.query.sort
        : 'rating';
      const genres = queryValues(req.query.genre);
      const platforms = queryValues(req.query.platform);
      const gameModes = queryValues(req.query.gameMode);
      const filter = { mergedIntoId: null, archivedAt: null, hiddenAt: null };
      if (req.query.q?.trim()) {
        const search = escapeRegex(String(req.query.q).trim());
        filter.$or = [
          { canonicalTitle: { $regex: search, $options: 'i' } },
          { alternativeTitles: { $regex: search, $options: 'i' } }
        ];
      }
      if (genres.length) filter.genres = { $in: genres };
      if (platforms.length) filter.platforms = { $in: platforms };
      if (gameModes.length) filter.gameModes = { $in: gameModes };
      const sortStage =
        sort === 'name'
          ? { canonicalTitle: 1, _id: 1 }
          : sort === 'owners'
            ? { ownerCount: -1, canonicalTitle: 1, _id: 1 }
            : { ratingMissing: 1, rating: -1, canonicalTitle: 1, _id: 1 };
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: 'library_items_v2',
            let: { gameId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$canonicalGameId', '$$gameId'] },
                      { $eq: [{ $ifNull: ['$removedAt', null] }, null] }
                    ]
                  }
                }
              },
              { $group: { _id: '$userId' } }
            ],
            as: 'owners'
          }
        },
        {
          $set: {
            ownerCount: { $size: '$owners' },
            ratingMissing: { $cond: [{ $eq: ['$rating', null] }, 1, 0] }
          }
        },
        { $sort: sortStage },
        { $skip: (page - 1) * pageSize },
        { $limit: pageSize }
      ];
      const [games, total] = await Promise.all([
        CanonicalGame.aggregate(pipeline),
        CanonicalGame.countDocuments(filter)
      ]);
      const ownership = await ownershipByGame(
        req.user._id,
        games.map((game) => game._id)
      );
      res.json({
        games: games.map((game) => gameDto(game, ownership.get(game._id.toString()))),
        page: { number: page, size: pageSize, total },
        filters: { genres, platforms, gameModes },
        sort
      });
    } catch (error) {
      next(error);
    }
  });
  router.get('/games/:gameId', requireAuth(config), async (req, res, next) => {
    try {
      if (!mongoose.isObjectIdOrHexString(req.params.gameId))
        throw new AppError(400, 'invalid_request', 'gameId must be valid');
      const [game] = await CanonicalGame.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(req.params.gameId),
            hiddenAt: null,
            archivedAt: null,
            mergedIntoId: null
          }
        },
        {
          $lookup: {
            from: 'library_items_v2',
            let: { gameId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$canonicalGameId', '$$gameId'] },
                      { $eq: [{ $ifNull: ['$removedAt', null] }, null] }
                    ]
                  }
                }
              },
              { $group: { _id: '$userId' } }
            ],
            as: 'owners'
          }
        },
        { $set: { ownerCount: { $size: '$owners' } } }
      ]);
      if (!game) throw new AppError(404, 'not_found', 'Game was not found');
      const ownership = await ownershipByGame(req.user._id, [game._id]);
      res.json({ game: gameDto(game, ownership.get(game._id.toString())) });
    } catch (error) {
      next(error);
    }
  });
  router.get('/games/:gameId/owners', requireAuth(config), async (req, res, next) => {
    try {
      if (!mongoose.isObjectIdOrHexString(req.params.gameId))
        throw new AppError(400, 'invalid_request', 'gameId must be valid');
      if (
        !(await CanonicalGame.exists({
          _id: req.params.gameId,
          hiddenAt: null,
          archivedAt: null,
          mergedIntoId: null
        }))
      )
        throw new AppError(404, 'not_found', 'Game was not found');
      const owners = await LibraryItem.aggregate([
        {
          $match: {
            canonicalGameId: new mongoose.Types.ObjectId(req.params.gameId),
            removedAt: null
          }
        },
        { $lookup: { from: 'users_v2', localField: 'userId', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        {
          $group: {
            _id: '$userId',
            username: { $first: '$user.usernameDisplay' },
            providers: { $addToSet: '$provider' }
          }
        },
        { $sort: { username: 1 } }
      ]);
      res.json({
        owners: owners.map((owner) => ({
          id: owner._id.toString(),
          username: owner.username,
          providers: owner.providers.sort()
        }))
      });
    } catch (error) {
      next(error);
    }
  });
  router.get('/game-filters', requireAuth(config), async (req, res, next) => {
    try {
      const visible = { hiddenAt: null, archivedAt: null, mergedIntoId: null };
      const [genres, platforms, gameModes] = await Promise.all([
        CanonicalGame.distinct('genres', visible),
        CanonicalGame.distinct('platforms', visible),
        CanonicalGame.distinct('gameModes', visible)
      ]);
      res.json({ genres: genres.sort(), platforms: platforms.sort(), gameModes: gameModes.sort() });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = { registerPublicCatalogueRoutes };
