const express = require('express');
const { requireAuth, requireRole } = require('../http/auth');
const { createIgdbClient } = require('../providers/igdbClient');
const { createItadClient } = require('../providers/itadClient');
const { registerMemberRoutes } = require('./casualFriday/memberRoutes');
const { registerEventRoutes } = require('./casualFriday/eventRoutes');
const { registerPlaylistRoutes } = require('./casualFriday/playlistRoutes');
const { registerProposalRoutes } = require('./casualFriday/proposalRoutes');
const { registerRotationRoutes } = require('./casualFriday/rotationRoutes');

function createCasualFridayRouter(config, dependencies = {}) {
  const router = express.Router();
  const manage = [requireAuth(config), requireRole('helper', 'admin')];
  const member = [requireAuth(config)];
  const admin = [requireAuth(config), requireRole('admin')];
  const itad = dependencies.itadClient || createItadClient({ apiKey: config.providers.itadApiKey });
  const igdb =
    dependencies.igdbClient ||
    createIgdbClient({
      clientId: config.providers.igdbClientId,
      clientSecret: config.providers.igdbClientSecret
    });

  registerMemberRoutes(router, config);
  registerEventRoutes(router, member, manage);
  registerProposalRoutes(router, config, manage);
  registerRotationRoutes(router, manage, admin, { igdb, itad });
  registerPlaylistRoutes(router, manage, { itad });

  return router;
}

module.exports = { createCasualFridayRouter };
