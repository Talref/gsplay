const express = require('express');
const { requireAuth, requireRole } = require('../http/auth');
const { createIgdbClient } = require('../../core/providers/igdbClient');
const awards = require('../../core/services/awardsService');

function createAwardsRouter(config, { igdbClient } = {}) {
  const router = express.Router();
  let client = igdbClient;
  const igdb = () =>
    (client ||= createIgdbClient({
      clientId: config.providers.igdbClientId,
      clientSecret: config.providers.igdbClientSecret
    }));
  const handle = (action) => async (req, res, next) => {
    try {
      res.json(await action(req));
    } catch (error) {
      next(error);
    }
  };
  router.get(
    '/awards',
    requireAuth(config),
    handle((req) => awards.memberView(req.user))
  );
  router.get(
    '/awards/games',
    requireAuth(config),
    handle((req) => awards.search(req.user, req.query.q, igdb()))
  );
  for (const phase of ['nominations', 'ballots']) {
    router.post(
      `/awards/${phase}`,
      requireAuth(config),
      handle(async (req) => {
        await awards.submit(req.user, phase, req.body, igdb());
        return awards.memberView(req.user);
      })
    );
  }
  router.use('/admin/awards', requireAuth(config), requireRole('admin'));
  router.get(
    '/admin/awards',
    handle(() => awards.adminView())
  );
  const mutate = (action) =>
    handle(async (req) => {
      await action(req);
      return awards.adminView();
    });
  router.post(
    '/admin/awards',
    mutate((req) => awards.create(req.user))
  );
  router.put(
    '/admin/awards/categories',
    mutate((req) => awards.saveCategories(req.user, req.body, igdb()))
  );
  router.put(
    '/admin/awards/winners',
    mutate((req) => awards.saveWinners(req.user, req.body))
  );
  router.post(
    '/admin/awards/:action',
    mutate((req) => awards.transition(req.user, req.params.action, req.body))
  );
  return router;
}
module.exports = { createAwardsRouter };
