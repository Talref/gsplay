/**
 * Pagination Helper
 * Utility functions for pagination calculations
 */

/**
 * Calculate skip value for MongoDB queries
 * @param {number} page - Current page number (1-based)
 * @param {number} limit - Items per page
 * @returns {number} Skip value for MongoDB query
 */
function calculateSkip(page = 1, limit = 20) {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, parseInt(limit) || 20);
  return (pageNum - 1) * limitNum;
}

/**
 * Calculate total number of pages
 * @param {number} total - Total number of items
 * @param {number} limit - Items per page
 * @returns {number} Total number of pages
 */
function calculateTotalPages(total, limit = 20) {
  const totalNum = Math.max(0, parseInt(total) || 0);
  const limitNum = Math.max(1, parseInt(limit) || 20);
  return Math.ceil(totalNum / limitNum);
}

/**
 * Validate and adjust page bounds
 * @param {number} page - Requested page number
 * @param {number} totalPages - Total number of pages
 * @returns {number} Valid page number within bounds
 */
function validatePageBounds(page = 1, totalPages = 1) {
  const pageNum = parseInt(page) || 1;
  const totalPagesNum = Math.max(1, parseInt(totalPages) || 1);

  if (pageNum < 1) return 1;
  if (pageNum > totalPagesNum) return totalPagesNum;
  return pageNum;
}

/**
 * Get pagination info for a given page
 * @param {number} total - Total number of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Object} Pagination information
 */
function getPaginationInfo(total, page = 1, limit = 20) {
  const totalPages = calculateTotalPages(total, limit);
  const currentPage = validatePageBounds(page, totalPages);
  const skip = calculateSkip(currentPage, limit);

  return {
    currentPage,
    totalPages,
    totalItems: total,
    itemsPerPage: limit,
    skip,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
    nextPage: currentPage < totalPages ? currentPage + 1 : null,
    prevPage: currentPage > 1 ? currentPage - 1 : null,
    startItem: skip + 1,
    endItem: Math.min(skip + limit, total)
  };
}

/**
 * Calculate offset for different database types
 * @param {number} page - Current page number (1-based)
 * @param {number} limit - Items per page
 * @param {string} dbType - Database type ('mongodb', 'sql')
 * @returns {number} Offset value
 */
function calculateOffset(page = 1, limit = 20, dbType = 'mongodb') {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, parseInt(limit) || 20);

  if (dbType === 'sql') {
    // SQL uses 0-based offset
    return (pageNum - 1) * limitNum;
  } else {
    // MongoDB also uses 0-based offset
    return (pageNum - 1) * limitNum;
  }
}

/**
 * Get page numbers for pagination display
 * @param {number} currentPage - Current page number
 * @param {number} totalPages - Total number of pages
 * @param {number} maxDisplay - Maximum number of page numbers to display
 * @returns {Array} Array of page numbers to display
 */
function getPageNumbers(currentPage, totalPages, maxDisplay = 7) {
  const pages = [];
  const current = Math.max(1, Math.min(currentPage, totalPages));
  const total = Math.max(1, totalPages);

  if (total <= maxDisplay) {
    // Show all pages if total is less than max display
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    // Calculate range around current page
    const half = Math.floor(maxDisplay / 2);
    let start = Math.max(1, current - half);
    let end = Math.min(total, start + maxDisplay - 1);

    // Adjust start if we're near the end
    if (end - start + 1 < maxDisplay) {
      start = Math.max(1, end - maxDisplay + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    // Add ellipsis indicators
    if (start > 1) {
      pages.unshift('...');
      pages.unshift(1);
    }

    if (end < total) {
      pages.push('...');
      pages.push(total);
    }
  }

  return pages;
}

module.exports = {
  calculateSkip,
  calculateTotalPages,
  validatePageBounds,
  getPaginationInfo,
  calculateOffset,
  getPageNumbers
};
