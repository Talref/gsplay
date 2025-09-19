/**
 * Input Sanitization Middleware
 * Cleans and validates user input to prevent security vulnerabilities
 */

/**
 * Input sanitization middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function sanitizeInput(req, res, next) {
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize route parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  // Sanitize body (for POST/PUT requests)
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  next();
}

/**
 * Recursively sanitize an object
 * @param {Object|Array|string} obj - Object to sanitize
 * @param {number} depth - Current recursion depth (prevents infinite loops)
 * @returns {Object|Array|string} Sanitized object
 */
function sanitizeObject(obj, depth = 0) {
  // Prevent infinite recursion
  if (depth > 10) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip sensitive fields that shouldn't be sanitized
      if (isSensitiveField(key)) {
        sanitized[key] = value;
      } else {
        sanitized[sanitizeString(key)] = sanitizeObject(value, depth + 1);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sanitize a string value
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
  if (typeof str !== 'string') {
    return '';
  }

  return str
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove carriage returns and line feeds
    .replace(/[\r\n]/g, '')
    // Trim whitespace
    .trim()
    // Limit length to prevent buffer overflow attacks
    .substring(0, 10000);
}

/**
 * Check if a field should be considered sensitive and not sanitized
 * @param {string} fieldName - Field name to check
 * @returns {boolean} True if field is sensitive
 */
function isSensitiveField(fieldName) {
  const sensitiveFields = [
    'password',
    'token',
    'authorization',
    'cookie',
    'session',
    'secret',
    'key',
    'private'
  ];

  return sensitiveFields.some(field =>
    fieldName.toLowerCase().includes(field)
  );
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if email is valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate MongoDB ObjectId format
 * @param {string} id - ID to validate
 * @returns {boolean} True if ID is valid ObjectId
 */
function isValidObjectId(id) {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  return objectIdRegex.test(id);
}

/**
 * Escape HTML characters
 * @param {string} str - String to escape
 * @returns {string} HTML-escaped string
 */
function escapeHtml(str) {
  const htmlEscapes = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#x27;',
    '/': '&#x2F;'
  };

  return str.replace(/[&<>"'/]/g, char => htmlEscapes[char]);
}

module.exports = {
  sanitizeInput,
  sanitizeString,
  sanitizeObject,
  isValidEmail,
  isValidObjectId,
  escapeHtml
};
