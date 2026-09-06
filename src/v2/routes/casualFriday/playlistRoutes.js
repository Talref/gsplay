const { AppError } = require('../../http/errors');
const { exactKeys, object, string } = require('../../http/validate');
const Playlist = require('../../models/CasualFridayPlaylist');
const service = require('../../services/casualFridayService');
const { TmdbProviderError } = require('../../providers/tmdbClient');
const { id, integer } = require('./validation');

function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1)
    throw new AppError(400, 'invalid_request', `${field} must be a positive integer`);
  return value;
}

function optionalNumber(value, field, min, max, { integerOnly = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new AppError(400, 'invalid_request', `${field} must be between ${min} and ${max}`);
  if (integerOnly && !Number.isInteger(value))
    throw new AppError(400, 'invalid_request', `${field} must be an integer`);
  return value;
}

function optionalHttpsUrl(value, field) {
  if (value === null || value === undefined || value === '') return null;
  let url;
  try {
    url = new URL(string(value, field, { max: 2048 }));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, 'invalid_request', `${field} must be an HTTPS URL`);
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password)
    throw new AppError(400, 'invalid_request', `${field} must be an HTTPS URL`);
  return url.href;
}

function movieEdits(value) {
  object(value);
  exactKeys(value, ['version', 'title', 'overview', 'posterUrl', 'rating', 'runtimeMinutes']);
  return {
    title: string(value.title, 'title', { max: 300 }),
    overview: string(value.overview ?? '', 'overview', { min: 0, max: 4000 }),
    posterUrl: optionalHttpsUrl(value.posterUrl, 'posterUrl'),
    rating: optionalNumber(value.rating, 'rating', 0, 10),
    runtimeMinutes: optionalNumber(value.runtimeMinutes, 'runtimeMinutes', 1, 1440, {
      integerOnly: true
    })
  };
}

function tmdbError(error) {
  if (!(error instanceof TmdbProviderError)) return error;
  const unconfigured = /not configured/i.test(error.message);
  return new AppError(
    unconfigured ? 503 : 502,
    unconfigured ? 'tmdb_not_configured' : 'tmdb_unavailable',
    unconfigured
      ? 'TMDB is not configured on this server'
      : 'TMDB is unavailable right now. The playlist was not changed.'
  );
}

function registerPlaylistRoutes(router, manage, { itad, tmdb }) {
  router.get('/casual-friday/tools/movies/search', ...manage, async (req, res, next) => {
    try {
      const query = string(req.query.q, 'q', { min: 2, max: 100 });
      res.json({ movies: await tmdb.searchMovies(query) });
    } catch (error) {
      next(tmdbError(error));
    }
  });

  router.post('/casual-friday/tools/playlist/movie-entries', ...manage, async (req, res, next) => {
    try {
      const value = object(req.body);
      exactKeys(value, ['tmdbId']);
      const movie = await tmdb.getMovie(positiveInteger(value.tmdbId, 'tmdbId'));
      res.json({ playlist: await service.addMovieToPlaylist(req.user, movie) });
    } catch (error) {
      next(tmdbError(error));
    }
  });

  router.put(
    '/casual-friday/tools/playlist/:playlistId/entries/:entryId/movie',
    ...manage,
    async (req, res, next) => {
      try {
        const value = object(req.body);
        const edits = movieEdits(value);
        res.json({
          playlist: await service.updatePlaylistMovie(
            req.user,
            id(req.params.playlistId, 'playlistId'),
            id(req.params.entryId, 'entryId'),
            integer(value.version, 'version'),
            edits
          )
        });
      } catch (error) {
        next(error);
      }
    }
  );
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
