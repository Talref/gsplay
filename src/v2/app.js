const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { isDatabaseReady } = require('./database');
const { createAuthRouter } = require('./routes/authRoutes');
const { createLibraryRouter } = require('./routes/libraryRoutes');
const { createCatalogueRouter } = require('./routes/catalogueRoutes');
const { createRetroRouter } = require('./routes/retroRoutes');
const { errorHandler, notFoundHandler } = require('./http/errors');
const { requestContext } = require('./http/requestContext');

function createApp(config, dependencies = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet()); app.use(requestContext);
  app.use(cors({ origin: config.corsOrigins, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'] }));
  app.use(express.json({ limit: config.uploadMaxBytes })); app.use(cookieParser());
  app.get('/health/live', (req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', (req, res) => res.status(isDatabaseReady() ? 200 : 503).json({ status: isDatabaseReady() ? 'ready' : 'unavailable' }));
  app.use('/api/v2/auth', createAuthRouter(config));
  app.use('/api/v2', createLibraryRouter(config));
  app.use('/api/v2', createCatalogueRouter(config));
  app.use('/api/v2', createRetroRouter(config, dependencies));
  app.use('/api/v2/me', require('./http/auth').requireAuth(config), (req, res) => res.json({ user: req.user.toPublic() }));
  app.use(notFoundHandler); app.use(errorHandler);
  return app;
}
module.exports = { createApp };