/**
 * Error Response Formatter
 * Standardizes error responses across the application
 */

const ERROR_TYPES = require('./errorTypes');
const HTTP_STATUS = require('./httpStatusCodes');
const ERROR_MESSAGES = require('./errorMessages');

/**
 * Create standardized error response
 * @param {string} type - Error type from ERROR_TYPES
 * @param {string} message - Custom error message (optional)
 * @param {Object} details - Additional error details (optional)
 * @param {string} requestId - Request correlation ID (optional)
 * @returns {Object} Standardized error response
 */
function createErrorResponse(type, message = null, details = null, requestId = null) {
  const errorResponse = {
    success: false,
    error: {
      code: type,
      message: message || getDefaultMessage(type),
      timestamp: new Date().toISOString()
    }
  };

  if (details) {
    errorResponse.error.details = details;
  }

  if (requestId) {
    errorResponse.error.requestId = requestId;
  }

  return errorResponse;
}

/**
 * Get default message for error type
 * @param {string} type - Error type
 * @returns {string} Default error message
 */
function getDefaultMessage(type) {
  const messageMap = {
    [ERROR_TYPES.VALIDATION_ERROR]: 'Validation failed',
    [ERROR_TYPES.UNAUTHORIZED]: ERROR_MESSAGES.UNAUTHORIZED,
    [ERROR_TYPES.FORBIDDEN]: ERROR_MESSAGES.FORBIDDEN,
    [ERROR_TYPES.NOT_FOUND]: 'Resource not found',
    [ERROR_TYPES.INTERNAL_SERVER_ERROR]: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    [ERROR_TYPES.SERVICE_UNAVAILABLE]: ERROR_MESSAGES.SERVICE_UNAVAILABLE,
    [ERROR_TYPES.RATE_LIMIT_EXCEEDED]: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED
  };

  return messageMap[type] || 'An error occurred';
}

/**
 * Create validation error response
 * @param {Array} errors - Array of validation errors
 * @param {string} requestId - Request correlation ID (optional)
 * @returns {Object} Validation error response
 */
function createValidationErrorResponse(errors, requestId = null) {
  const details = errors.map(error => ({
    field: error.field,
    message: error.message,
    value: error.value
  }));

  return createErrorResponse(
    ERROR_TYPES.VALIDATION_ERROR,
    'Validation failed',
    { fields: details },
    requestId
  );
}

/**
 * Create not found error response
 * @param {string} resource - Resource type that was not found
 * @param {string} requestId - Request correlation ID (optional)
 * @returns {Object} Not found error response
 */
function createNotFoundResponse(resource, requestId = null) {
  return createErrorResponse(
    ERROR_TYPES.NOT_FOUND,
    ERROR_MESSAGES.NOT_FOUND(resource),
    { resource },
    requestId
  );
}

/**
 * Create database error response
 * @param {Error} error - Database error object
 * @param {string} requestId - Request correlation ID (optional)
 * @returns {Object} Database error response
 */
function createDatabaseErrorResponse(error, requestId = null) {
  // Don't expose internal database errors to client
  const isDevelopment = process.env.NODE_ENV === 'development';

  return createErrorResponse(
    ERROR_TYPES.DATABASE_ERROR,
    ERROR_MESSAGES.DATABASE_ERROR,
    isDevelopment ? { originalError: error.message } : undefined,
    requestId
  );
}

/**
 * Create external service error response
 * @param {string} service - Service name (e.g., 'IGDB', 'Steam')
 * @param {Error} error - Original error (optional)
 * @param {string} requestId - Request correlation ID (optional)
 * @returns {Object} External service error response
 */
function createExternalServiceErrorResponse(service, error = null, requestId = null) {
  const serviceMessages = {
    'IGDB': ERROR_MESSAGES.IGDB_API_ERROR,
    'Steam': ERROR_MESSAGES.STEAM_API_ERROR
  };

  return createErrorResponse(
    ERROR_TYPES.EXTERNAL_SERVICE_ERROR,
    serviceMessages[service] || ERROR_MESSAGES.EXTERNAL_SERVICE_ERROR,
    error && process.env.NODE_ENV === 'development' ? { originalError: error.message } : undefined,
    requestId
  );
}

module.exports = {
  createErrorResponse,
  createValidationErrorResponse,
  createNotFoundResponse,
  createDatabaseErrorResponse,
  createExternalServiceErrorResponse
};
