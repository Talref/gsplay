const crypto = require('node:crypto');
const { AppError } = require('./errors');

function tokenDigest(value) {
  return crypto.createHash('sha256').update(value).digest();
}

function requireIntegrationToken(config) {
  return (req, res, next) => {
    const configuredToken = config.serverStatus.integrationToken;
    if (!configuredToken)
      return next(
        new AppError(503, 'integration_unavailable', 'Server-status integration is not configured')
      );
    const match = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
    if (!match || !crypto.timingSafeEqual(tokenDigest(match[1]), tokenDigest(configuredToken)))
      return next(
        new AppError(401, 'invalid_integration_token', 'Integration authentication failed')
      );
    return next();
  };
}

module.exports = { requireIntegrationToken };
