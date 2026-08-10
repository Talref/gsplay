const express = require('express');
const { AppError } = require('../http/errors');
const { requireIntegrationToken } = require('../http/integrationAuth');
const { serverStatusRateLimit } = require('../http/rateLimit');
const { replaceServerStatusSnapshot } = require('../services/serverStatusService');

function parseServerStatusJson(config) {
  const parse = express.json({ limit: config.serverStatus.maxBytes });
  return (req, res, next) =>
    parse(req, res, (error) => {
      if (!error) return next();
      if (error.type === 'entity.too.large')
        return next(
          new AppError(
            413,
            'server_status_too_large',
            'Server-status payload exceeds the configured size limit'
          )
        );
      return next(new AppError(400, 'invalid_json', 'Request body must contain valid JSON'));
    });
}

function createIntegrationRouter(config) {
  const router = express.Router();
  router.put(
    '/server-status',
    serverStatusRateLimit(config),
    requireIntegrationToken(config),
    parseServerStatusJson(config),
    async (req, res, next) => {
      try {
        res.json({ snapshot: await replaceServerStatusSnapshot(req.body) });
      } catch (error) {
        next(error);
      }
    }
  );
  return router;
}

module.exports = { createIntegrationRouter };
