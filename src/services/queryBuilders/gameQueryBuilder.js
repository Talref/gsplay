/**
 * Game Query Builder
 * Handles construction of MongoDB queries for game searches
 */

const { platforms: platformConfig, search: searchConfig } = require('../../../config/games');

/**
 * Build MongoDB query object from search parameters
 * @param {Object} params - Search parameters from request
 * @returns {Object} MongoDB query object
 */
function buildSearchQuery(params) {
  const {
    name = '',
    genres = [],
    platforms = [],
    gameModes = [],
    page = 1,
    limit = searchConfig.defaultLimit,
    sortBy = searchConfig.defaultSort.field,
    sortOrder = searchConfig.defaultSort.order === 1 ? 'asc' : 'desc'
  } = params;

  // Build MongoDB query
  const query = {};

  // Text search on name (case-insensitive regex)
  if (name && name.trim()) {
    query.name = { $regex: name.trim(), $options: 'i' };
  }

  // Array filters
  if (genres.length > 0) {
    const genreArray = Array.isArray(genres) ? genres : [genres];
    query.genres = { $in: genreArray };
  }

  if (platforms.length > 0) {
    let platformArray = Array.isArray(platforms) ? platforms : [platforms];

    // Expand "PC" category to include all PC platforms using config
    if (platformArray.includes('PC')) {
      const pcPlatforms = platformConfig.groups.pc;
      // Replace "PC" with actual PC platforms, and keep any other selected platforms
      platformArray = platformArray.filter(p => p !== 'PC').concat(pcPlatforms);
    }

    query.availablePlatforms = { $in: platformArray };
  }

  if (gameModes.length > 0) {
    const modeArray = Array.isArray(gameModes) ? gameModes : [gameModes];
    query.gameModes = { $in: modeArray };
  }

  // Only return enriched games (with IGDB data) - as originally intended
  // This ensures only properly enriched games are displayed to users
  query.igdbId = { $exists: true, $ne: null, $ne: -1, $type: 'number', $gte: 0 };

  return query;
}

/**
 * Build sort options object
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - Sort order ('asc' or 'desc')
 * @returns {Object} MongoDB sort object
 */
function buildSortQuery(sortBy = 'name', sortOrder = 'asc') {
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
  return sortOptions;
}

/**
 * Build pagination options
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Object} Pagination options
 */
function buildPaginationQuery(page = 1, limit = 20) {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  return {
    skip,
    limit: parseInt(limit)
  };
}

/**
 * Build complete query options for Game.find()
 * @param {Object} params - Search parameters
 * @returns {Object} Complete query options
 */
function buildCompleteQueryOptions(params) {
  const query = buildSearchQuery(params);
  const sort = buildSortQuery(params.sortBy, params.sortOrder);
  const pagination = buildPaginationQuery(params.page, params.limit);

  return {
    query,
    sort,
    skip: pagination.skip,
    limit: pagination.limit
  };
}

module.exports = {
  buildSearchQuery,
  buildSortQuery,
  buildPaginationQuery,
  buildCompleteQueryOptions
};
