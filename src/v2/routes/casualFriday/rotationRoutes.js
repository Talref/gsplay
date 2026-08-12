const { exactKeys, object, string } = require('../../http/validate');
const { AppError } = require('../../http/errors');
const service = require('../../services/casualFridayService');
const { id, rotationBody } = require('./validation');

function registerRotationRoutes(router, manage, admin, { igdb, itad }) {
  router.get('/casual-friday/tools/rotation', ...manage, async (req, res, next) => {
    try {
      res.json({ rotation: await service.listRotation({ itadClient: itad, includeOffer: true }) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/casual-friday/tools/rotation/from-catalogue', ...manage, async (req, res, next) => {
    try {
      res.status(201).json({
        rotation: await service.createRotation(req.user, rotationBody(req.body, 'catalogue'), {
          itadClient: itad
        })
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/casual-friday/tools/rotation/from-igdb-url', ...manage, async (req, res, next) => {
    try {
      res.status(201).json({
        rotation: await service.createExternalRotation(req.user, rotationBody(req.body, 'igdb'), {
          igdbClient: igdb,
          itadClient: itad
        })
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/casual-friday/tools/rotation/manual', ...manage, async (req, res, next) => {
    try {
      res.status(201).json({
        rotation: await service.createExternalRotation(req.user, rotationBody(req.body, 'manual'), {
          itadClient: itad
        })
      });
    } catch (error) {
      next(error);
    }
  });

  router.put('/casual-friday/tools/rotation/:id', ...manage, async (req, res, next) => {
    try {
      res.json({
        rotation: await service.updateRotation(
          req.user,
          id(req.params.id, 'id'),
          rotationBody(req.body),
          { itadClient: itad }
        )
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/casual-friday/tools/rotation/:id/recheck-itad',
    ...manage,
    async (req, res, next) => {
      try {
        res.json({
          rotation: await service.recheckItad(req.user, id(req.params.id, 'id'), {
            itadClient: itad
          })
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post('/casual-friday/tools/rotation/:id/retire', ...manage, async (req, res, next) => {
    try {
      const value = object(req.body);
      exactKeys(value, ['reason']);
      await service.retireRotation(
        req.user,
        id(req.params.id, 'id'),
        string(value.reason, 'reason', { max: 1000 })
      );
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.put('/casual-friday/tools/rotation/:id/voting', ...admin, async (req, res, next) => {
    try {
      const value = object(req.body);
      exactKeys(value, ['enabled']);
      if (typeof value.enabled !== 'boolean')
        throw new AppError(400, 'invalid_request', 'enabled must be a boolean');
      res.json({
        rotation: await service.setVotingEnabled(
          req.user,
          id(req.params.id, 'id'),
          value.enabled
        )
      });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = { registerRotationRoutes };
