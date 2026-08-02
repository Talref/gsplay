const express = require('express');
const { requireAuth, requireRole } = require('../http/auth');
const { createIgdbClient } = require('../providers/igdbClient');
const { createItadClient } = require('../providers/itadClient');
const { registerMemberRoutes } = require('./casualFriday/memberRoutes');
const { registerPlaylistRoutes } = require('./casualFriday/playlistRoutes');
const { registerRotationRoutes } = require('./casualFriday/rotationRoutes');

function createCasualFridayRouter(config, dependencies = {}) {
  const router = express.Router();
  const manage = [requireAuth(config), requireRole('helper', 'admin')];
  const itad = dependencies.itadClient || createItadClient({ apiKey: config.providers.itadApiKey });
  const igdb =
    dependencies.igdbClient ||
    createIgdbClient({
      clientId: config.providers.igdbClientId,
      clientSecret: config.providers.igdbClientSecret
    });

  registerMemberRoutes(router, config);
  registerRotationRoutes(router, manage, { igdb, itad });
  registerPlaylistRoutes(router, manage, { itad });

  return router;
}

module.exports = { createCasualFridayRouter };
