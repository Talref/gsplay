const { AppError } = require('../../http/errors');
const { exactKeys, object, string } = require('../../http/validate');
const service = require('../../services/casualFridayService');
const { id, integer } = require('./validation');

function registerEventRoutes(router, member, manage) {
  router.get('/casual-friday/tools/event', ...manage, async (req, res, next) => {
    try {
      res.json({ event: await service.manageEventDto(await service.upcomingEvent()) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/casual-friday/tools/event/start', ...manage, async (req, res, next) => {
    try {
      const value = object(req.body);
      exactKeys(value, []);
      res.status(201).json({ event: await service.startEvent(req.user) });
    } catch (error) {
      next(error);
    }
  });

  router.put('/casual-friday/events/:id/rsvp', ...member, async (req, res, next) => {
    try {
      const value = object(req.body);
      exactKeys(value, ['rsvp']);
      const rsvp = string(value.rsvp, 'rsvp', { max: 5 }).toLowerCase();
      if (!['yes', 'maybe', 'no'].includes(rsvp))
        throw new AppError(400, 'invalid_request', 'rsvp must be yes, maybe, or no');
      res.json({ event: await service.setRsvp(req.user, id(req.params.id, 'id'), rsvp) });
    } catch (error) {
      next(error);
    }
  });

  router.put('/casual-friday/events/:id/votes', ...member, async (req, res, next) => {
    try {
      const value = object(req.body);
      exactKeys(value, ['rotationGameIds']);
      if (!Array.isArray(value.rotationGameIds))
        throw new AppError(400, 'invalid_request', 'rotationGameIds must be an array');
      res.json({
        event: await service.setVotes(
          req.user,
          id(req.params.id, 'id'),
          value.rotationGameIds.map((rotationId, index) =>
            id(rotationId, `rotationGameIds[${index}]`)
          )
        )
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/casual-friday/tools/event/:id/draft', ...manage, async (req, res, next) => {
    try {
      const value = object(req.body);
      exactKeys(value, ['version']);
      res.json({
        event: await service.createDraft(
          req.user,
          id(req.params.id, 'id'),
          integer(value.version, 'version')
        )
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/casual-friday/tools/event/:id/cancel', ...manage, async (req, res, next) => {
    try {
      const value = object(req.body);
      exactKeys(value, ['version', 'reason']);
      res.json({
        event: await service.cancelEvent(
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

  router.post('/casual-friday/tools/event/:id/complete', ...manage, async (req, res, next) => {
    try {
      const value = object(req.body);
      exactKeys(value, ['version']);
      res.json({
        event: await service.completeEvent(
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

module.exports = { registerEventRoutes };
