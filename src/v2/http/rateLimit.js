const rateLimit = require('express-rate-limit');
const { AppError } = require('./errors');

function authRateLimit(config) {
  return rateLimit({
    windowMs: config.auth.rateLimitWindowMs,
    limit: config.auth.rateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.nodeEnv === 'test',
    handler: (req, res, next) => next(new AppError(429, 'auth_rate_limited', 'Too many authentication attempts; try again later'))
  });
}

module.exports = { authRateLimit };