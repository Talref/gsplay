/**
 * Game Service - Functional Approach
 * Handles game data operations and IGDB integration
 */

const Game = require('../models/Game');
const { syncUserGames, addGamesToDatabase } = require('./ownership/gameOwnershipManager');
const { findUnenrichedGames: findUnenrichedGamesFromFinder, findFailedEnrichments: findFailedEnrichmentsFromFinder } = require('./gameMatching/gameFinder');
const { enrichGamesBatch, restoreFailedGames } = require('./igdb/gameIntegrationService');

/**
 * Search games with filters
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of games
 */
async function searchGames(options = {}) {
  const {
    query, // text search
    genres,
    platforms,
    gameModes,
    minRating,
    sortBy = 'name',
    sortOrder = 1,
    limit = 20,
    skip = 0
  } = options;

  let filter = {};

  // Text search on name
  if (query) {
    filter.name = { $regex: query, $options: 'i' };
  }

  // Array filters
  if (genres && genres.length > 0) {
    filter.genres = { $in: genres };
  }

  if (platforms && platforms.length > 0) {
    filter.availablePlatforms = { $in: platforms };
  }

  if (gameModes && gameModes.length > 0) {
    filter.gameModes = { $in: gameModes };
  }

  // Rating filter
  if (minRating !== undefined) {
    filter.rating = { $gte: minRating };
  }

  const sort = {};
  sort[sortBy] = sortOrder;

  return await Game.find(filter)
    .sort(sort)
    .limit(limit)
    .skip(skip);
}

/**
 * Sync game ownership when user adds/removes games
 * @param {string} userId - User ID
 * @param {Array} userGames - User games
 * @returns {Promise<Object>} Sync result
 */
async function syncGameOwnership(userId, userGames) {
  return await syncUserGames(userId, userGames, {
    enableEnrichment: true,
    context: 'user-sync'
  });
}

/**
 * Get game statistics for dashboard
 * @returns {Promise<Object>} Game statistics
 */
async function getGameStats() {
  const stats = await Game.aggregate([
    {
      $group: {
        _id: null,
        totalGames: { $sum: 1 },
        totalOwners: { $sum: { $size: '$owners' } },
        avgRating: { $avg: '$rating' },
        genres: { $addToSet: '$genres' },
        platforms: { $addToSet: '$availablePlatforms' }
      }
    }
  ]);

  if (stats.length > 0) {
    // Flatten and deduplicate arrays
    stats[0].genres = [...new Set(stats[0].genres.flat().filter(Boolean))];
    stats[0].platforms = [...new Set(stats[0].platforms.flat().filter(Boolean))];
  }

  return stats[0] || {
    totalGames: 0,
    totalOwners: 0,
    avgRating: 0,
    genres: [],
    platforms: []
  };
}

/**
 * Find games that need IGDB enrichment
 * @param {number} limit - Maximum number of games to return
 * @returns {Promise<Array>} Array of unenriched games
 */
async function findUnenrichedGames(limit = 100) {
  const games = await findUnenrichedGamesFromFinder({ limit });
  console.log(`📊 Found ${games.length} unenriched games`);
  return games;
}

/**
 * Find games that failed IGDB enrichment
 * @param {number} limit - Maximum number of games to return
 * @returns {Promise<Array>} Array of failed enrichment games
 */
async function findFailedEnrichments(limit = 50) {
  const games = await findFailedEnrichmentsFromFinder({ limit });
  console.log(`📊 Found ${games.length} failed enrichment games`);
  return games;
}

module.exports = {
  searchGames,
  syncGameOwnership,
  addGamesToDatabase,
  getGameStats,
  findUnenrichedGames,
  findFailedEnrichments,
  // Re-export IGDB functions for backward compatibility
  enrichGamesBatch,
  restoreFailedGames
};
