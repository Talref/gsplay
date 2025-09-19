/**
 * Game Ownership Manager
 * Handles synchronization of user game ownership across the database
 */

const Game = require('../../models/Game');
const { executeBulkOperations, createBulkOwnershipOperations } = require('./bulkOperationHelper');
const { enrichGamesBatch } = require('../igdb/gameIntegrationService');

/**
 * Synchronize user games with database
 * @param {string} userId - User ID
 * @param {Array} userGames - Array of user games from external source
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Sync result
 */
async function syncUserGames(userId, userGames, options = {}) {
  const {
    enableEnrichment = true,
    context = 'sync'
  } = options;

  try {
    // Get all current games for this user from Game model
    const currentGames = await Game.find({ 'owners.userId': userId });

    // Create maps for efficient lookup
    const userGameMap = new Map();
    userGames.forEach(game => {
      userGameMap.set(game.name.toLowerCase(), game);
    });

    const currentGameMap = new Map();
    currentGames.forEach(game => {
      currentGameMap.set(game.name.toLowerCase(), game);
    });

    // Find games to add ownership to
    const gamesToAdd = userGames.filter(game => {
      return !currentGameMap.has(game.name.toLowerCase());
    });

    // Don't remove ownership - sync only adds games, doesn't manage ownership removal
    const gamesToRemove = [];

    // Create bulk operations using helper
    const bulkOps = createBulkOwnershipOperations(userId, gamesToAdd, gamesToRemove);

    // Execute bulk operations
    const bulkResult = await executeBulkOperations(bulkOps);

    // Attempt immediate IGDB enrichment for newly added games
    let enrichedCount = 0;
    if (enableEnrichment && gamesToAdd.length > 0) {
      console.log(`🎯 Attempting IGDB enrichment for ${gamesToAdd.length} new games...`);

      // Fetch the actual Mongoose documents created by bulkWrite
      const gameNames = gamesToAdd.map(game => game.name);
      const gameDocuments = await Game.find({
        name: { $in: gameNames }
      });

      console.log(`📋 Retrieved ${gameDocuments.length} Mongoose documents for enrichment`);

      // Use the existing enrichment method
      enrichedCount = await enrichGamesBatch(gameDocuments, context);
    }

    return {
      success: true,
      added: gamesToAdd.length,
      removed: gamesToRemove.length,
      enriched: enrichedCount,
      bulkResult
    };

  } catch (error) {
    console.error('Error syncing user games:', error);
    throw error;
  }
}

/**
 * Add games to database without ownership management (for admin operations)
 * @param {string} userId - User ID
 * @param {Array} userGames - Array of user games
 * @returns {Promise<Object>} Result
 */
async function addGamesToDatabase(userId, userGames) {
  return await syncUserGames(userId, userGames, {
    enableEnrichment: false,
    context: 'admin-scan'
  });
}

module.exports = {
  syncUserGames,
  addGamesToDatabase
};
