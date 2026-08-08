const express = require('express');
const { requireAuth, requireRole } = require('../http/auth');
const { AppError } = require('../http/errors');
const { exactKeys, object } = require('../http/validate');
const { getGuide, updateGuide } = require('../services/guideService');

const MAX_GUIDE_LENGTH = 100_000;

function validateMarkdown(value) {
  if (typeof value !== 'string' || value.length > MAX_GUIDE_LENGTH)
    throw new AppError(
      400,
      'invalid_request',
      `markdown must be a string containing at most ${MAX_GUIDE_LENGTH} characters`
    );
  return value;
}

function createGuideRouter(config) {
  const router = express.Router();
  router.get('/guide', requireAuth(config), async (req, res, next) => {
    try {
      res.json({ guide: await getGuide() });
    } catch (error) {
      next(error);
    }
  });
  router.put('/guide', requireAuth(config), requireRole('admin'), async (req, res, next) => {
    try {
      const body = object(req.body);
      exactKeys(body, ['markdown']);
      res.json({ guide: await updateGuide(validateMarkdown(body.markdown)) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

module.exports = { createGuideRouter };
