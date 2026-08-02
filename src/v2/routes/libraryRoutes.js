const express = require('express');
const multer = require('multer');
const { AppError } = require('../http/errors');
const { registerImportRoutes } = require('./library/importRoutes');
const { registerMemberLibraryRoutes } = require('./library/memberLibraryRoutes');
const { registerPublicLibraryRoutes } = require('./library/publicLibraryRoutes');

function createUploadMiddleware(config) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.uploadMaxBytes, files: 1, fields: 1 },
    fileFilter: (req, file, callback) =>
      callback(
        null,
        ['text/csv', 'application/csv', 'application/json', 'text/json'].includes(file.mimetype)
      )
  });

  return (req, res, next) =>
    upload.single('file')(req, res, (error) => {
      if (error)
        return next(
          new AppError(
            400,
            'invalid_import_file',
            error.code === 'LIMIT_FILE_SIZE'
              ? 'Upload exceeds the configured size limit'
              : 'Upload must contain one supported file field'
          )
        );
      if (!req.file)
        return next(new AppError(400, 'invalid_import_file', 'Upload requires one file field'));
      return next();
    });
}

function createLibraryRouter(config) {
  const router = express.Router();

  registerPublicLibraryRoutes(router);
  registerMemberLibraryRoutes(router, config);
  registerImportRoutes(router, config, createUploadMiddleware(config));

  return router;
}

module.exports = { createLibraryRouter };
