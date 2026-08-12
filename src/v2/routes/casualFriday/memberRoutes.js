const Playlist = require('../../models/CasualFridayPlaylist');
const Event = require('../../models/CasualFridayEvent');
const { requireAuth } = require('../../http/auth');
const service = require('../../services/casualFridayService');

function registerMemberRoutes(router, config) {
  router.get('/casual-friday', requireAuth(config), async (req, res, next) => {
    try {
      const window = service.nextFridayWindow();
      const event = await Event.findOne({ weekKey: window.weekKey });
      const playlist = await Playlist.findOne({
        status: 'published',
        endsAt: { $gt: new Date() }
      }).sort({ startsAt: 1 });
      res.json({
        event: await service.memberEventDto(event, req.user._id),
        playlist: await service.buildPlaylistDto(playlist, req.user._id)
      });
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
