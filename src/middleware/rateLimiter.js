/**
 * Rate Limiting Middleware
 * Configured using centralized configuration
 */

const rateLimit = require('express-rate-limit');
const appConfig = require('../../config/app');
const rateLimitConfig = appConfig.security.rateLimit;

// General API rate limiter using config
const apiLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  message: rateLimitConfig.message,
  standardHeaders: rateLimitConfig.standardHeaders,
  legacyHeaders: rateLimitConfig.legacyHeaders
});

// Stricter rate limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: 3 * 60 * 1000, // 3 minutes (keep separate from general config)
  max: 5, // Limit each IP to 5 auth attempts per window
  message: {
    error: 'Too many authentication attempts. Please try again later.'
  },
  skipSuccessfulRequests: true, // Don't count successful logins/signups
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for search endpoints
const searchLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: 30, // Allow more requests for search
  message: rateLimitConfig.message,
  standardHeaders: rateLimitConfig.standardHeaders,
  legacyHeaders: rateLimitConfig.legacyHeaders
});

module.exports = {
  apiLimiter,
  authLimiter,
  searchLimiter
};
