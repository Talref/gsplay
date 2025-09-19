/**
 * Pagination Data Transformer
 * Handles creation and formatting of pagination metadata
 */

const { pagination: paginationConfig } = require('../../../config/games');

/**
 * Create pagination metadata object
 * @param {number} total - Total number of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
function createPaginationMetadata(total, page = paginationConfig.defaultPage, limit = paginationConfig.defaultLimit) {
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.max(1, Math.min(page, totalPages)); // Ensure page is within bounds

  return {
    page: currentPage,
    limit: parseInt(limit),
    total,
    pages: totalPages,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
    nextPage: currentPage < totalPages ? currentPage + 1 : null,
    prevPage: currentPage > 1 ? currentPage - 1 : null
  };
}

/**
 * Add navigation links to pagination metadata
 * @param {Object} pagination - Pagination metadata
 * @param {string} baseUrl - Base URL for pagination links
 * @param {Object} queryParams - Query parameters to include in links
 * @returns {Object} Pagination metadata with links
 */
function addPaginationLinks(pagination, baseUrl = '', queryParams = {}) {
  if (!pagination) return pagination;

  const links = {};

  // Build query string from params
  const buildQueryString = (params) => {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, v));
        } else {
          searchParams.append(key, value);
        }
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  };

  // Add current page params
  const currentParams = { ...queryParams, page: pagination.page, limit: pagination.limit };

  // First page link
  if (pagination.page > 1) {
    links.first = baseUrl + buildQueryString({ ...currentParams, page: 1 });
  }

  // Previous page link
  if (pagination.hasPrev) {
    links.prev = baseUrl + buildQueryString({ ...currentParams, page: pagination.prevPage });
  }

  // Current page link
  links.current = baseUrl + buildQueryString(currentParams);

  // Next page link
  if (pagination.hasNext) {
    links.next = baseUrl + buildQueryString({ ...currentParams, page: pagination.nextPage });
  }

  // Last page link
  if (pagination.page < pagination.pages) {
    links.last = baseUrl + buildQueryString({ ...currentParams, page: pagination.pages });
  }

  return {
    ...pagination,
    links
  };
}

/**
 * Create comprehensive pagination response
 * @param {Array} items - Items for current page
 * @param {number} total - Total number of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {string} baseUrl - Base URL for links (optional)
 * @param {Object} queryParams - Query parameters (optional)
 * @returns {Object} Complete pagination response
 */
function createPaginationResponse(items, total, page = 1, limit = 20, baseUrl = '', queryParams = {}) {
  const pagination = createPaginationMetadata(total, page, limit);

  // Add links if baseUrl is provided
  const paginationWithLinks = baseUrl
    ? addPaginationLinks(pagination, baseUrl, queryParams)
    : pagination;

  return {
    items,
    pagination: paginationWithLinks
  };
}

/**
 * Validate pagination parameters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {number} maxLimit - Maximum allowed limit
 * @returns {Object} Validation result
 */
function validatePaginationParams(page = 1, limit = 20, maxLimit = 100) {
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
  } else if (limitNum > maxLimit) {
    errors.push(`Limit cannot exceed ${maxLimit}`);
    validated.limit = maxLimit;
  } else {
    validated.limit = limitNum;
  }

  return {
    isValid: errors.length === 0,
    errors,
    validated
  };
}

module.exports = {
  createPaginationMetadata,
  addPaginationLinks,
  createPaginationResponse,
  validatePaginationParams
};
