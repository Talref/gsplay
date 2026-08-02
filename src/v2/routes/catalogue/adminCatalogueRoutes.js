const { registerAdminGameRoutes } = require('./adminGameRoutes');
const {
  registerAdminMaintenanceRoutes,
  registerMetadataRefreshRoute
} = require('./adminMaintenanceRoutes');
const { registerMatchResolutionRoute, registerMatchReviewRoute } = require('./adminMatchRoutes');

function registerAdminCatalogueRoutes(router, config, igdb) {
  registerAdminMaintenanceRoutes(router, config);
  registerAdminGameRoutes(router, config, igdb);
  registerMatchReviewRoute(router, config);
  registerMetadataRefreshRoute(router, config);
  registerMatchResolutionRoute(router, config);
}

module.exports = { registerAdminCatalogueRoutes };
