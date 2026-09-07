const express = require('express');
const { requireAuth, requireRole } = require('../http/auth');
const { createIgdbClient } = require('../providers/igdbClient');
const { createItadClient } = require('../providers/itadClient');
const { createTmdbClient } = require('../providers/tmdbClient');
const { registerMemberRoutes } = require('./casualFriday/memberRoutes');
const { registerEventRoutes } = require('./casualFriday/eventRoutes');
const { registerPlaylistRoutes } = require('./casualFriday/playlistRoutes');
const { registerProposalRoutes } = require('./casualFriday/proposalRoutes');
const { registerRotationRoutes } = require('./casualFriday/rotationRoutes');

function createCasualFridayRouter(config, dependencies = {}) {
  const router = express.Router();
  const manage = [requireAuth(config), requireRole('helper', 'admin')];
  const member = [requireAuth(config)];
  const itad = dependencies.itadClient || createItadClient({ apiKey: config.providers.itadApiKey });
  const tmdb =
    dependencies.tmdbClient || createTmdbClient({ accessToken: config.providers.tmdbAccessToken });
  const igdb =
    dependencies.igdbClient ||
    createIgdbClient({
      clientId: config.providers.igdbClientId,
      clientSecret: config.providers.igdbClientSecret
    });

  registerMemberRoutes(router, config);
  registerEventRoutes(router, member, manage);
  registerProposalRoutes(router, config, manage);
  registerRotationRoutes(router, manage, { igdb, itad });
  registerPlaylistRoutes(router, manage, { itad, tmdb });

  return router;
}

module.exports = { createCasualFridayRouter };
