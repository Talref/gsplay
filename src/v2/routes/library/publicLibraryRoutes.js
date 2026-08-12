const User = require('../../models/User');
const { exactKeys, object } = require('../../http/validate');
const { compareLibraries } = require('../../services/libraryComparisonService');

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
      exactKeys(req.body, [
        'userIds',
        'genres',
        'multiplayerOnly',
        'multiplayerModes',
        'page',
        'pageSize'
      ]);
      res.json(await compareLibraries(req.body));
    } catch (error) {
      next(error);
    }
  });
}

module.exports = { registerPublicLibraryRoutes };
