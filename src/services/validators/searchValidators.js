/**
 * Search Validators
 * Handles validation and sanitization of search parameters
 */

const { search: searchConfig, pagination: paginationConfig } = require('../../../config/games');

/**
 * Validate search parameters
 * @param {Object} params - Search parameters from request
 * @returns {Object} Validation result
 */
function validateSearchParams(params) {
  const errors = [];
  const validated = {};

  // Validate name (search term) - allow empty for "show all games"
  if (params.name !== undefined) {
    if (typeof params.name === 'string') {
      const sanitized = sanitizeInput(params.name);
      // Allow empty strings (show all games) or valid length strings
      if (sanitized.length === 0 || (sanitized.length >= searchConfig.minQueryLength && sanitized.length <= searchConfig.maxQueryLength)) {
        validated.name = sanitized;
      } else if (sanitized.length > 0) {
        // Only show error for non-empty strings that are too short/long
        errors.push(`Search term must be empty or between ${searchConfig.minQueryLength} and ${searchConfig.maxQueryLength} characters`);
      }
    } else if (params.name !== null && params.name !== '') {
      errors.push('Name must be a string, null, or empty');
    }
  }

  // Validate genres
  if (params.genres !== undefined) {
    const genres = Array.isArray(params.genres) ? params.genres : [params.genres];
    validated.genres = genres
      .filter(g => g && typeof g === 'string')
      .map(g => sanitizeInput(g))
      .filter(g => g.length > 0);
  }

  // Validate platforms
  if (params.platforms !== undefined) {
    const platforms = Array.isArray(params.platforms) ? params.platforms : [params.platforms];
    validated.platforms = platforms
      .filter(p => p && typeof p === 'string')
      .map(p => sanitizeInput(p))
      .filter(p => p.length > 0);
  }

  // Validate gameModes
  if (params.gameModes !== undefined) {
    const gameModes = Array.isArray(params.gameModes) ? params.gameModes : [params.gameModes];
    validated.gameModes = gameModes
      .filter(m => m && typeof m === 'string')
      .map(m => sanitizeInput(m))
      .filter(m => m.length > 0);
  }

  // Validate pagination parameters using config
  const paginationValidation = validatePaginationParams(params.page, params.limit, paginationConfig.maxLimit);
  if (!paginationValidation.isValid) {
    errors.push(...paginationValidation.errors);
  }
  Object.assign(validated, paginationValidation.validated);

  // Validate sort parameters
  const sortValidation = validateSortParams(params.sortBy, params.sortOrder);
  if (!sortValidation.isValid) {
    errors.push(...sortValidation.errors);
  }
  Object.assign(validated, sortValidation.validated);

  return {
    isValid: errors.length === 0,
    errors,
    validated
  };
}

/**
 * Validate pagination parameters
 * @param {number|string} page - Page number
 * @param {number|string} limit - Items per page
 * @returns {Object} Validation result
 */
function validatePaginationParams(page = 1, limit = 20) {
  const errors = [];
  const validated = {};

  // Validate page
  const pageNum = parseInt(page);
  if (isNaN(pageNum) || pageNum < 1) {
    errors.push('Page must be a positive integer');
    validated.page = 1;
  } else {
    validated.page = pageNum;
  }

  // Validate limit
  const limitNum = parseInt(limit);
  if (isNaN(limitNum) || limitNum < 1) {
    errors.push('Limit must be a positive integer');
    validated.limit = 20;
  } else if (limitNum > 100) {
    errors.push('Limit cannot exceed 100');
    validated.limit = 100;
  } else {
    validated.limit = limitNum;
  }

  return {
    isValid: errors.length === 0,
    errors,
    validated
  };
}

/**
 * Validate sort parameters
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - Sort order ('asc' or 'desc')
 * @returns {Object} Validation result
 */
function validateSortParams(sortBy = 'name', sortOrder = 'asc') {
  const errors = [];
  const validated = {};

  // Allowed sort fields
  const allowedSortFields = ['name', 'rating', 'releaseDate', 'ownerCount', 'createdAt'];

  // Validate sortBy
  if (!allowedSortFields.includes(sortBy)) {
    errors.push(`Sort field must be one of: ${allowedSortFields.join(', ')}`);
    validated.sortBy = 'name';
  } else {
    validated.sortBy = sortBy;
  }

  // Validate sortOrder
  const normalizedOrder = sortOrder.toLowerCase();
  if (!['asc', 'desc'].includes(normalizedOrder)) {
    errors.push('Sort order must be "asc" or "desc"');
    validated.sortOrder = 'asc';
  } else {
    validated.sortOrder = normalizedOrder;
  }

  return {
    isValid: errors.length === 0,
    errors,
    validated
  };
}

/**
 * Sanitize input string
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove potentially dangerous characters and trim
  return input
    .replace(/[<>\"'&]/g, '') // Remove HTML/XML dangerous chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Validate game ID parameter
 * @param {string} gameId - Game ID to validate
 * @returns {Object} Validation result
 */
function validateGameId(gameId) {
  const errors = [];
  let validated = null;

  if (!gameId || typeof gameId !== 'string') {
    errors.push('Game ID is required and must be a string');
  } else {
    // Basic MongoDB ObjectId validation (24 hex characters)
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(gameId)) {
      errors.push('Invalid game ID format');
    } else {
      validated = gameId;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    validated
  };
}

module.exports = {
  validateSearchParams,
  validatePaginationParams,
  validateSortParams,
  sanitizeInput,
  validateGameId
};
