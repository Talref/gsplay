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

  // Only log detailed info in development
  if (process.env.NODE_ENV === 'development') {
    console.log('📨 Incoming Request:', JSON.stringify(logData, null, 2));
  } else {
    // Production: log minimal info
    console.log(`📨 ${req.method} ${req.url} - ${req.requestId}`);
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

  const logData = {
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    responseSize: getResponseSize(data)
  };

  // Log based on status code
  if (res.statusCode >= 400) {
    console.error('❌ Error Response:', JSON.stringify(logData, null, 2));
  } else if (process.env.NODE_ENV === 'development') {
    console.log('📤 Response:', JSON.stringify(logData, null, 2));
  } else {
    console.log(`📤 ${res.statusCode} ${req.method} ${req.url} - ${duration}ms`);
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
