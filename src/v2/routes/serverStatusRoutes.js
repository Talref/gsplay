const express = require('express');
const { requireAuth } = require('../http/auth');
const { getServerStatusSnapshot } = require('../services/serverStatusService');

function createServerStatusRouter(config) {
  const router = express.Router();
  router.get('/server-status', requireAuth(config), async (req, res, next) => {
    try {
      res.json({
        snapshot: await getServerStatusSnapshot(config.serverStatus.staleAfterMs)
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

module.exports = { createServerStatusRouter };
