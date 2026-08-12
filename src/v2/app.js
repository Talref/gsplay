const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { isDatabaseReady } = require('./database');
const { createAuthRouter } = require('./routes/authRoutes');
const { createLibraryRouter } = require('./routes/libraryRoutes');
const { createCatalogueRouter } = require('./routes/catalogueRoutes');
const { createRetroRouter } = require('./routes/retroRoutes');
const { createAdminUserRouter } = require('./routes/adminUserRoutes');
const { createCasualFridayRouter } = require('./routes/casualFridayRoutes');
const { createGuideRouter } = require('./routes/guideRoutes');
const { createIntegrationRouter } = require('./routes/integrationRoutes');
const { createServerStatusRouter } = require('./routes/serverStatusRoutes');
const { errorHandler, notFoundHandler } = require('./http/errors');
const { requestContext } = require('./http/requestContext');
const { createSocialPreviewHandler } = require('./http/socialPreview');
const { resolveSocialMetadata } = require('./services/socialMetadataService');

function createApp(config, dependencies = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          frameAncestors: ["'self'"],
          frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          upgradeInsecureRequests: []
        }
      }
    })
  );
  app.use(requestContext);
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
    })
  );
  app.use('/api/v2/integrations', createIntegrationRouter(config));
  app.use(express.json({ limit: config.uploadMaxBytes }));
  app.use(cookieParser());
  app.use(
    '/uploads/guide',
    express.static(config.guide.uploadDir, {
      dotfiles: 'deny',
      fallthrough: true,
      immutable: true,
      index: false,
      maxAge: '1y'
    })
  );
  app.get('/health/live', (req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', (req, res) =>
    res
      .status(isDatabaseReady() ? 200 : 503)
      .json({ status: isDatabaseReady() ? 'ready' : 'unavailable' })
  );
  app.use('/api/v2/auth', createAuthRouter(config));
  app.use('/api/v2', createLibraryRouter(config));
  app.use('/api/v2', createCatalogueRouter(config, dependencies));
  app.use('/api/v2', createRetroRouter(config, dependencies));
  app.use('/api/v2', createAdminUserRouter(config));
  app.use('/api/v2', createCasualFridayRouter(config, dependencies));
  app.use('/api/v2', createGuideRouter(config));
  app.use('/api/v2', createServerStatusRouter(config));
  app.use('/api/v2/me', require('./http/auth').requireAuth(config), (req, res) =>
    res.json({ user: req.user.toPublic() })
  );
  const socialPreviewHandler = createSocialPreviewHandler(config, {
    template: dependencies.frontendTemplate,
    templatePath: dependencies.frontendTemplatePath,
    resolveMetadata: dependencies.socialMetadataResolver || resolveSocialMetadata
  });
  if (socialPreviewHandler) app.get(/.*/, socialPreviewHandler);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
