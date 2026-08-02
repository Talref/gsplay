const User = require('../../models/User');
const LibraryItem = require('../../models/LibraryItem');
const { AppError } = require('../../http/errors');
const { exactKeys, object } = require('../../http/validate');
const { asId } = require('./common');

function registerPublicLibraryRoutes(router) {
  router.get('/users', async (req, res, next) => {
    try {
      const users = await User.find({}, 'usernameDisplay').sort({ usernameDisplay: 1 }).lean();
      res.json({
        users: users.map((user) => ({ id: user._id.toString(), username: user.usernameDisplay }))
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/library-comparisons', async (req, res, next) => {
    try {
      object(req.body);
      exactKeys(req.body, ['userIds']);
      const ids = Array.isArray(req.body.userIds)
        ? req.body.userIds.map((id) => asId(id, 'userIds'))
        : [];
      const uniqueIds = [...new Map(ids.map((id) => [id.toString(), id])).values()];
      if (uniqueIds.length !== ids.length || uniqueIds.length < 1 || uniqueIds.length > 10)
        throw new AppError(400, 'invalid_request', 'Select between one and ten distinct users');
      const users = await User.find({ _id: { $in: uniqueIds } }, 'usernameDisplay').lean();
      if (users.length !== uniqueIds.length)
        throw new AppError(404, 'not_found', 'One or more selected users were not found');
      const rows = await LibraryItem.aggregate([
        { $match: { userId: { $in: uniqueIds }, removedAt: null, canonicalGameId: { $ne: null } } },
        { $group: { _id: '$canonicalGameId', owners: { $addToSet: '$userId' } } },
        { $match: { $expr: { $eq: [{ $size: '$owners' }, uniqueIds.length] } } },
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
        { $sort: { 'game.canonicalTitle': 1 } }
      ]);
      res.json({
        users: users.map((user) => ({ id: user._id.toString(), username: user.usernameDisplay })),
        games: rows.map((row) => ({
          id: row._id.toString(),
          title: row.game.canonicalTitle,
          artwork: row.game.artwork,
          igdbUrl: row.game.igdbUrl,
          ownerIds: row.owners.map(String)
        }))
      });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = { registerPublicLibraryRoutes };
