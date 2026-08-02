const Playlist = require('../../models/CasualFridayPlaylist');
const { requireAuth } = require('../../http/auth');
const service = require('../../services/casualFridayService');

function registerMemberRoutes(router, config) {
  router.get('/casual-friday', requireAuth(config), async (req, res, next) => {
    try {
      const playlist = await Playlist.findOne({
        status: 'published',
        endsAt: { $gt: new Date() }
      }).sort({ startsAt: 1 });
      res.json({ playlist: await service.buildPlaylistDto(playlist, req.user._id) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/casual-friday/rotation', requireAuth(config), async (req, res, next) => {
    try {
      res.json({
        rotation: (await service.listRotation()).filter((item) => item.status === 'active')
      });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = { registerMemberRoutes };
