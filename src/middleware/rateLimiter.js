const rateLimit = require('express-rate-limit');

// Basic rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each IP to 5 requests per window
  message: { 
    error: 'Too many attempts. Please try again later.' 
  },
  skipSuccessfulRequests: true, // Don't count successful logins/signups
});

module.exports = authLimiter;