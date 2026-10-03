const GsbotGuildConfig = require('../models/GsbotGuildConfig');

function removeObsoleteTagAuthorization() {
  return GsbotGuildConfig.collection.updateMany(
    { roles: { $exists: true } },
    { $unset: { roles: '' } }
  );
}

module.exports = { removeObsoleteTagAuthorization };
