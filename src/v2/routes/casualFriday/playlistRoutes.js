const { AppError } = require('../../http/errors');
const { exactKeys, object, string } = require('../../http/validate');
const Playlist = require('../../models/CasualFridayPlaylist');
const service = require('../../services/casualFridayService');
const { id, integer } = require('./validation');

function registerPlaylistRoutes(router, manage, { itad }) {
  router.get('/casual-friday/tools/playlist', ...manage, async (req, res, next) => {
    try {
      const window = service.nextFridayWindow();
      res.json({
        playlist: await service.buildPlaylistDto(
          await Playlist.findOne({ weekKey: window.weekKey }),
          req.user._id,
          { itadClient: itad, includeOffers: true }
        )
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/casual-friday/tools/playlist/entries/:rotationId',
    ...manage,
    async (req, res, next) => {
      try {
        res.json({
          playlist: await service.addToPlaylist(req.user, id(req.params.rotationId, 'rotationId'), {
            itadClient: itad
          })
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    '/casual-friday/tools/playlist/:playlistId/entries/:entryId',
    ...manage,
    async (req, res, next) => {
      try {
        const value = object(req.body);
        exactKeys(value, ['version']);
        res.json({
          playlist: await service.removeFromPlaylist(
            req.user,
            id(req.params.playlistId, 'playlistId'),
            id(req.params.entryId, 'entryId'),
            integer(value.version, 'version'),
            { itadClient: itad }
          )
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/casual-friday/tools/playlist/:playlistId/entries/:entryId/key-offer',
    ...manage,
    async (req, res, next) => {
      try {
        const value = object(req.body);
        exactKeys(value, ['version', 'price', 'url']);
        res.json({
          playlist: await service.updateKeyOffer(
            req.user,
            id(req.params.playlistId, 'playlistId'),
            id(req.params.entryId, 'entryId'),
            integer(value.version, 'version'),
            { price: value.price, url: string(value.url, 'url', { max: 2048 }) }
          )
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    '/casual-friday/tools/playlist/:playlistId/entries/:entryId/key-offer',
    ...manage,
    async (req, res, next) => {
      try {
        const value = object(req.body);
        exactKeys(value, ['version']);
        res.json({
          playlist: await service.removeKeyOffer(
            req.user,
            id(req.params.playlistId, 'playlistId'),
            id(req.params.entryId, 'entryId'),
            integer(value.version, 'version')
          )
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.put('/casual-friday/tools/playlist/:id/order', ...manage, async (req, res, next) => {
    try {
      const value = object(req.body);
      exactKeys(value, ['version', 'entryIds']);
      if (!Array.isArray(value.entryIds))
        throw new AppError(400, 'invalid_request', 'entryIds must be an array');
      const entryIds = value.entryIds.map((entryId, index) => id(entryId, `entryIds[${index}]`));
      res.json({
        playlist: await service.reorderPlaylist(
          req.user,
          id(req.params.id, 'id'),
          entryIds,
          integer(value.version, 'version'),
          { itadClient: itad }
        )
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/casual-friday/tools/playlist/:id/confirm', ...manage, async (req, res, next) => {
    try {
      const value = object(req.body);
      exactKeys(value, ['version']);
      res.json({
        playlist: await service.publishPlaylist(
          req.user,
          id(req.params.id, 'id'),
          integer(value.version, 'version'),
          { itadClient: itad }
        )
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/casual-friday/tools/playlist/:id/cancel', ...manage, async (req, res, next) => {
    try {
      const value = object(req.body);
      exactKeys(value, ['version', 'reason']);
      res.json({
        playlist: await service.cancelPlaylist(
          req.user,
          id(req.params.id, 'id'),
          integer(value.version, 'version'),
          string(value.reason, 'reason', { max: 1000 })
        )
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/casual-friday/tools/playlist/:id/restore', ...manage, async (req, res, next) => {
    try {
      const value = object(req.body);
      exactKeys(value, ['version']);
      res.json({
        playlist: await service.restoreCancelledPlaylist(
          req.user,
          id(req.params.id, 'id'),
          integer(value.version, 'version')
        )
      });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = { registerPlaylistRoutes };
