/**
 * Unified Search Service
 * Consolidates search logic across different parts of the application
 */

const { buildCompleteQueryOptions } = require('../queryBuilders/gameQueryBuilder');
const { transformGamesForList } = require('../dataTransformers/gameTransformer');
const { createPaginationMetadata } = require('../dataTransformers/paginationTransformer');
const { validateSearchParams } = require('../validators/searchValidators');
const Game = require('../../models/Game');

/**
 * Perform unified game search
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} Search results with pagination
 */
async function performGameSearch(params) {
  // Validate and sanitize input parameters
  const validation = validateSearchParams(params);
  if (!validation.isValid) {
    throw new Error(`Invalid search parameters: ${validation.errors.join(', ')}`);
  }

  const validatedParams = validation.validated;

  // Build query options using the query builder
  const { query, sort, skip, limit } = buildCompleteQueryOptions(validatedParams);

  // Execute query with proper field selection
  const games = await Game.find(query)
    .select('name genres availablePlatforms gameModes rating artwork releaseDate owners description videos')
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();

  // Get total count for pagination
  const total = await Game.countDocuments(query);

  // Transform games for response
  const transformedGames = transformGamesForList(games);

  // Create pagination metadata
  const pagination = createPaginationMetadata(total, validatedParams.page, validatedParams.limit);

  return {
    games: transformedGames,
    pagination,
    filters: {
      name: validatedParams.name,
      genres: validatedParams.genres,
      platforms: validatedParams.platforms,
      gameModes: validatedParams.gameModes
    }
  };
}

/**
 * Search games with filters (legacy method for backward compatibility)
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of games
 */
async function searchGames(options = {}) {
  const {
    query: searchQuery, // Rename to avoid conflict with MongoDB query
    genres,
    platforms,
    gameModes,
    minRating,
    sortBy = 'name',
    sortOrder = 1,
    limit = 20,
    skip = 0
  } = options;

  // Convert legacy format to new format
  const params = {
    name: searchQuery,
    genres: Array.isArray(genres) ? genres : genres ? [genres] : [],
    platforms: Array.isArray(platforms) ? platforms : platforms ? [platforms] : [],
    gameModes: Array.isArray(gameModes) ? gameModes : gameModes ? [gameModes] : [],
    page: Math.floor(skip / limit) + 1,
    limit,
    sortBy,
    sortOrder: sortOrder === -1 ? 'desc' : 'asc'
  };

  // Add rating filter if provided
  if (minRating !== undefined) {
    params.minRating = minRating;
  }

  const result = await performGameSearch(params);
  return result.games;
}

/**
 * Get game details with owner information
 * @param {string} gameId - Game ID
 * @returns {Promise<Object>} Game details
 */
async function getGameDetails(gameId) {
  const game = await Game.findById(gameId)
    .populate('owners.userId', 'name')
    .lean();

  if (!game) {
    throw new Error('Game not found');
  }

  // Transform game for detailed response
  const { transformGameForDetails } = require('../dataTransformers/gameTransformer');
  return transformGameForDetails(game);
}

/**
 * Advanced search with custom criteria
 * @param {Object} criteria - MongoDB query criteria
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Search results
 */
async function advancedSearch(criteria, options = {}) {
  const {
    limit = 20,
    skip = 0,
    sort = { name: 1 },
    includePagination = true
  } = options;

  // Execute query
  const games = await Game.find(criteria)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();

  if (!includePagination) {
    return { games };
  }

  // Get total count for pagination
  const total = await Game.countDocuments(criteria);
  const page = Math.floor(skip / limit) + 1;

  const { createPaginationMetadata } = require('../dataTransformers/paginationTransformer');
  const pagination = createPaginationMetadata(total, page, limit);

  return {
    games,
    pagination
  };
}

module.exports = {
  performGameSearch,
  searchGames,
  getGameDetails,
  advancedSearch
};
