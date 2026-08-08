const express = require('express');
const multer = require('multer');
const { requireAuth, requireRole } = require('../http/auth');
const { AppError } = require('../http/errors');
const { exactKeys, object } = require('../http/validate');
const { getGuide, updateGuide } = require('../services/guideService');
const { saveGuideImage } = require('../services/guideImageService');

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

function createImageUploadMiddleware(config) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.guide.imageMaxBytes, files: 1, fields: 0 }
  });
  return (req, res, next) =>
    upload.single('image')(req, res, (error) => {
      if (error)
        return next(
          new AppError(
            error.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
            error.code === 'LIMIT_FILE_SIZE' ? 'guide_image_too_large' : 'invalid_guide_image',
            error.code === 'LIMIT_FILE_SIZE'
              ? 'Guide image exceeds the configured size limit'
              : 'Upload must contain one image field'
          )
        );
      if (!req.file)
        return next(new AppError(400, 'invalid_guide_image', 'Upload requires one image field'));
      return next();
    });
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
  router.post(
    '/guide/images',
    requireAuth(config),
    requireRole('admin'),
    createImageUploadMiddleware(config),
    async (req, res, next) => {
      try {
        res.status(201).json(await saveGuideImage(req.file, config.guide.uploadDir));
      } catch (error) {
        next(error);
      }
    }
  );
  return router;
}

module.exports = { createGuideRouter };
