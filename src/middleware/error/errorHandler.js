/**
 * Global Error Handler Middleware
 * Catches and formats all errors consistently across the application
 */

const ERROR_TYPES = require('../../utils/errors/errorTypes');
const HTTP_STATUS = require('../../utils/errors/httpStatusCodes');
const { createErrorResponse, createDatabaseErrorResponse } = require('../../utils/errors/errorResponseFormatter');

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, next) {
  // Generate request ID for tracking
  const requestId = req.requestId || generateRequestId();

  // Log error with context
  logError(err, req, requestId);

  // Determine error type and HTTP status
  const { statusCode, errorResponse } = categorizeError(err, requestId);

  // Send standardized error response
  res.status(statusCode).json(errorResponse);
}

/**
 * Categorize error and determine appropriate response
 * @param {Error} err - Error object
 * @param {string} requestId - Request correlation ID
 * @returns {Object} Status code and error response
 */
function categorizeError(err, requestId) {
  // Mongoose/MongoDB errors
  if (err.name === 'ValidationError') {
    return {
      statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      errorResponse: createErrorResponse(
        ERROR_TYPES.VALIDATION_ERROR,
        'Validation failed',
        formatMongooseValidationError(err),
        requestId
      )
    };
  }

  if (err.name === 'CastError') {
    return {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      errorResponse: createErrorResponse(
        ERROR_TYPES.INVALID_FORMAT,
        'Invalid data format',
        { field: err.path, value: err.value },
        requestId
      )
    };
  }

  if (err.code === 11000) { // Duplicate key error
    return {
      statusCode: HTTP_STATUS.CONFLICT,
      errorResponse: createErrorResponse(
        ERROR_TYPES.ALREADY_EXISTS,
        'Resource already exists',
        { field: Object.keys(err.keyPattern)[0] },
        requestId
      )
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return {
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      errorResponse: createErrorResponse(
        ERROR_TYPES.TOKEN_INVALID,
        'Invalid authentication token',
        null,
        requestId
      )
    };
  }

  if (err.name === 'TokenExpiredError') {
    return {
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      errorResponse: createErrorResponse(
        ERROR_TYPES.TOKEN_EXPIRED,
        'Authentication token has expired',
        null,
        requestId
      )
    };
  }

  // External API errors
  if (err.response) {
    const statusCode = err.response.status;
    if (statusCode === 429) {
      return {
        statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
        errorResponse: createErrorResponse(
          ERROR_TYPES.RATE_LIMIT_EXCEEDED,
          'External service rate limit exceeded',
          null,
          requestId
        )
      };
    }
  }

  // Custom application errors
  if (err.statusCode) {
    return {
      statusCode: err.statusCode,
      errorResponse: createErrorResponse(
        err.type || ERROR_TYPES.INTERNAL_SERVER_ERROR,
        err.message,
        err.details,
        requestId
      )
    };
  }

  // Default server error
  return {
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorResponse: createErrorResponse(
      ERROR_TYPES.INTERNAL_SERVER_ERROR,
      'An unexpected error occurred',
      process.env.NODE_ENV === 'development' ? { originalError: err.message } : undefined,
      requestId
    )
  };
}

/**
 * Format Mongoose validation errors
 * @param {Error} err - Mongoose validation error
 * @returns {Object} Formatted validation errors
 */
function formatMongooseValidationError(err) {
  const errors = {};

  for (const field in err.errors) {
    errors[field] = {
      message: err.errors[field].message,
      value: err.errors[field].value,
      kind: err.errors[field].kind
    };
  }

  return { fields: errors };
}

/**
 * Generate unique request ID for error tracking
 * @returns {string} Request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log error with context information
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {string} requestId - Request correlation ID
 */
function logError(err, req, requestId) {
  const logData = {
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  };

  // In production, you might want to send this to a logging service
  console.error('Error occurred:', JSON.stringify(logData, null, 2));
}

module.exports = errorHandler;
