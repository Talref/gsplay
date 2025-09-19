/**
 * Request Logging Middleware
 * Logs incoming requests and outgoing responses for monitoring and debugging
 */

/**
 * Request logging middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requestLogger(req, res, next) {
  // Generate request ID for correlation
  req.requestId = generateRequestId();

  // Record start time
  req.startTime = Date.now();

  // Log incoming request
  logRequest(req);

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(data) {
    // Log outgoing response
    logResponse(req, res, data);

    // Call original json method
    return originalJson.call(this, data);
  };

  next();
}

/**
 * Log incoming request details
 * @param {Object} req - Express request object
 */
function logRequest(req) {
  const logLevel = process.env.LOG_LEVEL || 'minimal';

  // Skip logging for noisy endpoints unless in verbose mode
  if (shouldSkipLogging(req.url) && logLevel !== 'verbose') {
    return;
  }

  if (logLevel === 'verbose' || (process.env.NODE_ENV === 'development' && logLevel !== 'quiet')) {
    // Verbose logging with full details
    const logData = {
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: sanitizeHeaders(req.headers),
      ip: getClientIP(req),
      userAgent: req.get('User-Agent')
    };
    console.log('📨 Incoming Request:', JSON.stringify(logData, null, 2));
  } else {
    // Minimal logging - just essential info
    console.log(`📨 ${req.method} ${req.url}`);
  }
}

/**
 * Log outgoing response details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 */
function logResponse(req, res, data) {
  const duration = Date.now() - req.startTime;
  const logLevel = process.env.LOG_LEVEL || 'minimal';

  // Only log errors - successful responses are noise
  if (res.statusCode >= 400) {
    const logData = {
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: getResponseSize(data)
    };
    console.error('❌ Error Response:', JSON.stringify(logData, null, 2));
  }

  // In verbose mode, log slow requests (>1 second) for performance monitoring
  if (logLevel === 'verbose' && duration > 1000) {
    console.warn(`🐌 Slow Request: ${req.method} ${req.url} took ${duration}ms`);
  }
}

/**
 * Sanitize headers to remove sensitive information
 * @param {Object} headers - Request headers
 * @returns {Object} Sanitized headers
 */
function sanitizeHeaders(headers) {
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  const sanitized = { ...headers };

  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Get client IP address
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIP(req) {
  return req.ip ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         req.connection.socket?.remoteAddress ||
         'unknown';
}

/**
 * Check if request should be skipped from logging
 * @param {string} url - Request URL
 * @returns {boolean} True if request should be skipped
 */
function shouldSkipLogging(url) {
  const skipPatterns = [
    '/health',           // Health checks
    '/favicon.ico',      // Browser favicon requests
    '/refresh-token',    // JWT refresh tokens (very frequent)
    '/api/refresh-token', // API refresh tokens
    /^\/api\//,          // ALL API routes (frontend traffic)
    /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/, // Static assets
  ];

  return skipPatterns.some(pattern => {
    if (typeof pattern === 'string') {
      return url.includes(pattern);
    }
    return pattern.test(url);
  });
}

/**
 * Generate unique request ID
 * @returns {string} Request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get response size in bytes
 * @param {Object} data - Response data
 * @returns {string} Formatted size
 */
function getResponseSize(data) {
  try {
    const size = Buffer.byteLength(JSON.stringify(data), 'utf8');
    if (size < 1024) {
      return `${size}B`;
    } else if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)}KB`;
    } else {
      return `${(size / (1024 * 1024)).toFixed(1)}MB`;
    }
  } catch (error) {
    return 'unknown';
  }
}

module.exports = requestLogger;
