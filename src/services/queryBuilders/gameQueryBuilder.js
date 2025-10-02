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
 * Note: For ownerCount sorting, uses aggregation instead of find
 * @param {Object} params - Search parameters
 * @returns {Object} Complete query options with useAggregation flag
 */
function buildCompleteQueryOptions(params) {
  const query = buildSearchQuery(params);
  const pagination = buildPaginationQuery(params.page, params.limit);

  // Special handling for ownerCount sorting - use aggregation
  const useAggregation = params.sortBy === 'ownerCount';

  if (useAggregation) {
    const aggregation = buildOwnerCountAggregation(query, params.sortOrder, pagination.skip, pagination.limit);
    return {
      useAggregation,
      aggregation,
      query: null,
      sort: null,
      skip: null,
      limit: null
    };
  }

  // Standard find query
  const sort = buildSortQuery(params.sortBy, params.sortOrder);
  return {
    useAggregation: false,
    query,
    sort,
    skip: pagination.skip,
    limit: pagination.limit
  };
}

/**
 * Build aggregation pipeline for sorting by owner count
 * @param {Object} matchQuery - MongoDB match query
 * @param {string} sortOrder - 'asc' or 'desc'
 * @param {number} skip - Number of documents to skip
 * @param {number} limit - Number of documents to return
 * @returns {Array} Aggregation pipeline
 */
function buildOwnerCountAggregation(matchQuery, sortOrder, skip, limit) {
  return [
    { $match: matchQuery },
    {
      $addFields: {
        ownerCount: {
          $size: {
            $setUnion: {
              $map: {
                input: { $ifNull: ['$owners', []] },
                as: 'owner',
                in: '$$owner.userId'
              }
            }
          }
        }
      }
    },
    {
      $sort: {
        ownerCount: sortOrder === 'desc' ? -1 : 1,
        name: 1 // Secondary sort by name for consistent ordering
      }
    },
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        name: 1,
        genres: 1,
        availablePlatforms: 1,
        gameModes: 1,
        rating: 1,
        artwork: 1,
        releaseDate: 1,
        owners: 1 // Keep owners for transformer, but will be removed in response
      }
    }
  ];
}

module.exports = {
  buildSearchQuery,
  buildSortQuery,
  buildPaginationQuery,
  buildCompleteQueryOptions
};
