const express = require('express');
const { createIgdbClient } = require('../providers/igdbClient');
const { registerAdminCatalogueRoutes } = require('./catalogue/adminCatalogueRoutes');
const { videoDto } = require('./catalogue/common');
const { registerPublicCatalogueRoutes } = require('./catalogue/publicCatalogueRoutes');

function createCatalogueRouter(config, { igdbClient } = {}) {
  const router = express.Router();
  const igdb = () =>
    igdbClient ||
    createIgdbClient({
      clientId: config.providers.igdbClientId,
      clientSecret: config.providers.igdbClientSecret
    });

  registerPublicCatalogueRoutes(router, config);
  registerAdminCatalogueRoutes(router, config, igdb);
  return router;
}

module.exports = { createCatalogueRouter, videoDto };
