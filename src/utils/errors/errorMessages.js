/**
 * Standardized Error Messages
 * Predefined error messages for consistent user communication
 */

const ERROR_MESSAGES = {
  // Validation Messages
  REQUIRED_FIELD: (field) => `${field} is required`,
  INVALID_FORMAT: (field) => `${field} has an invalid format`,
  LENGTH_EXCEEDED: (field, max) => `${field} cannot exceed ${max} characters`,
  MIN_LENGTH: (field, min) => `${field} must be at least ${min} characters`,
  MAX_LENGTH: (field, max) => `${field} cannot exceed ${max} characters`,

  // Authentication Messages
  INVALID_CREDENTIALS: 'Invalid email or password',
  TOKEN_EXPIRED: 'Authentication token has expired',
  TOKEN_INVALID: 'Invalid authentication token',
  UNAUTHORIZED: 'Authentication required',

  // Authorization Messages
  FORBIDDEN: 'You do not have permission to perform this action',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',

  // Resource Messages
  NOT_FOUND: (resource) => `${resource} not found`,
  ALREADY_EXISTS: (resource) => `${resource} already exists`,
  RESOURCE_CONFLICT: 'Resource conflict occurred',

  // External Service Messages
  EXTERNAL_SERVICE_ERROR: 'External service temporarily unavailable',
  IGDB_API_ERROR: 'Game database service temporarily unavailable',
  STEAM_API_ERROR: 'Steam service temporarily unavailable',

  // Database Messages
  DATABASE_ERROR: 'Database operation failed',
  CONNECTION_ERROR: 'Database connection failed',

  // File/Upload Messages
  FILE_TOO_LARGE: (maxSize) => `File size cannot exceed ${maxSize}MB`,
  INVALID_FILE_TYPE: (allowedTypes) => `File type not allowed. Allowed: ${allowedTypes.join(', ')}`,
  UPLOAD_ERROR: 'File upload failed',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later',

  // System Messages
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  TIMEOUT_ERROR: 'Request timed out',

  // Search Messages
  SEARCH_TOO_SHORT: (minLength) => `Search term must be at least ${minLength} characters`,
  SEARCH_TOO_LONG: (maxLength) => `Search term cannot exceed ${maxLength} characters`,

  // Game Messages
  GAME_NOT_FOUND: 'Game not found',
  GAME_ALREADY_EXISTS: 'Game already exists in your library',

  // User Messages
  USER_NOT_FOUND: 'User not found',
  EMAIL_ALREADY_EXISTS: 'Email address already in use',
  INVALID_EMAIL_FORMAT: 'Invalid email address format'
};

module.exports = ERROR_MESSAGES;
