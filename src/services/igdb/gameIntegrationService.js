/**
 * Game Integration Service
 * Handles IGDB integration and game data enrichment
 */

const Game = require('../../models/Game');
const igdbService = require('../igdbService');
const { createExactMatchRegex, createFlexibleMatchRegex } = require('../gameMatching/nameMatcher');

/**
 * Create or update game from IGDB data
 * @param {number} igdbId - IGDB game ID
 * @param {Object} additionalData - Additional game data from IGDB
 * @param {Object} targetGame - Specific game document to update
 * @returns {Promise<Object>} Updated game document
 */
async function createOrUpdateFromIGDB(igdbId, additionalData = {}, targetGame = null) {
  try {
    // If we have a specific target game to update, use it first
    if (targetGame) {
      return await updateTargetGame(targetGame, igdbId, additionalData);
    }

    // Fallback: Find existing game by IGDB ID or name
    const existingGame = await findExistingGame(igdbId, additionalData.name);
    if (existingGame) {
      return await updateExistingGame(existingGame, igdbId, additionalData);
    }

    // Create new game if none found
    return await createNewGame(igdbId, additionalData);

  } catch (error) {
    console.error('Error creating/updating game from IGDB:', error);
    throw error;
  }
}

/**
 * Update a specific target game
 * @param {Object} targetGame - Game document to update
 * @param {number} igdbId - IGDB ID
 * @param {Object} additionalData - Additional data
 * @returns {Promise<Object>} Updated game
 */
async function updateTargetGame(targetGame, igdbId, additionalData) {
  console.log(`🎯 Updating target game: "${targetGame.name}" (ID: ${targetGame._id})`);

  const updateData = { igdbId, ...additionalData };
  delete updateData.name; // Don't overwrite the existing name
  updateData.lastUpdated = new Date();

  // Check if targetGame is a Mongoose document or plain object
  if (targetGame.save && typeof targetGame.save === 'function') {
    // It's a Mongoose document
    Object.assign(targetGame, updateData);
    return await targetGame.save();
  } else {
    // It's a plain object, use updateOne
    const Game = require('../../models/Game');
    return await Game.findByIdAndUpdate(
      targetGame._id,
      { $set: updateData },
      { new: true }
    );
  }
}

/**
 * Find existing game by IGDB ID or name matching
 * @param {number} igdbId - IGDB ID
 * @param {string} gameName - Game name
 * @returns {Promise<Object|null>} Existing game or null
 */
async function findExistingGame(igdbId, gameName) {
  // First try to find by IGDB ID
  let game = await Game.findOne({ igdbId });
  if (game) return game;

  if (!gameName) return null;

  // Try exact name match
  game = await Game.findOne({
    name: { $regex: createExactMatchRegex(gameName) }
  });
  if (game) return game;

  // Try flexible name matching for similar games
  const similarGames = await Game.find({
    name: { $regex: createFlexibleMatchRegex(gameName), $options: 'i' },
    owners: { $exists: true, $ne: [] }
  }).limit(5);

  if (similarGames.length > 0) {
    // Find the best match (exact match first, then highest owner count)
    const exactMatch = similarGames.find(g =>
      g.name.toLowerCase() === gameName.toLowerCase()
    );

    game = exactMatch || similarGames[0];
    console.log(`🔗 Matched similar game: "${game.name}" for IGDB: "${gameName}"`);
  }

  return game;
}

/**
 * Update an existing game with IGDB data
 * @param {Object} existingGame - Existing game document
 * @param {number} igdbId - IGDB ID
 * @param {Object} additionalData - Additional data
 * @returns {Promise<Object>} Updated game
 */
async function updateExistingGame(existingGame, igdbId, additionalData) {
  const updateData = { igdbId, ...additionalData };
  delete updateData.name; // Don't overwrite the existing name

  Object.assign(existingGame, updateData);
  existingGame.lastUpdated = new Date();

  return await existingGame.save();
}

/**
 * Create a new game document
 * @param {number} igdbId - IGDB ID
 * @param {Object} gameData - Game data
 * @returns {Promise<Object>} Created game
 */
async function createNewGame(igdbId, gameData) {
  const gameDocument = {
    igdbId,
    ...gameData,
    lastUpdated: new Date(),
    createdAt: new Date()
  };

  return await Game.create(gameDocument);
}

/**
 * Enrich a single game with IGDB data
 * @param {Object} game - Game document
 * @returns {Promise<boolean>} Success status
 */
async function enrichSingleGame(game) {
  try {
    const searchName = game.name;
    console.log(`🔍 Searching IGDB for: "${searchName}"`);

    const igdbResults = await igdbService.searchGames(searchName, 1);

    if (igdbResults.length > 0) {
      const igdbGame = igdbResults[0];
      console.log(`📋 Found IGDB match: "${igdbGame.name}" (ID: ${igdbGame.id})`);

      const details = await igdbService.getGameDetails(igdbGame.id);

      if (details) {
        console.log(`📝 Updating game "${game.name}" with IGDB ID ${igdbGame.id}`);

        const updatedGame = await createOrUpdateFromIGDB(igdbGame.id, {
          name: game.name, // Keep the original game name from database
          description: details.description,
          genres: details.genres,
          availablePlatforms: details.availablePlatforms,
          gameModes: details.gameModes,
          rating: details.rating,
          artwork: details.artwork,
          releaseDate: details.releaseDate,
          videos: details.videos,
          publishers: details.publishers,
          igdbUrl: details.igdbUrl
        }, game);

        console.log(`✅ Successfully updated game: ${updatedGame.name} (igdbId: ${updatedGame.igdbId})`);
        return true;
      }
    } else {
      console.log(`❌ No IGDB results found for: "${searchName}"`);
      await markGameAsFailed(game);
    }

    return false;

  } catch (error) {
    console.warn(`⚠️ Failed to enrich ${game.name}:`, error.message);
    await markGameAsFailed(game);
    return false;
  }
}

/**
 * Mark a game as failed enrichment
 * @param {Object} game - Game document or plain object
 * @returns {Promise<void>}
 */
async function markGameAsFailed(game) {
  try {
    const updateData = {
      igdbId: -1, // Sentinel value for failed enrichment
      lastUpdated: new Date()
    };

    // Check if game is a Mongoose document or plain object
    if (game.save && typeof game.save === 'function') {
      // It's a Mongoose document
      game.igdbId = -1;
      game.lastUpdated = new Date();
      await game.save();
    } else {
      // It's a plain object, use updateOne
      await Game.findByIdAndUpdate(game._id, { $set: updateData });
    }

    console.log(`🚫 Marked "${game.name}" as failed enrichment (igdbId: -1)`);
  } catch (error) {
    console.error(`Failed to mark game as failed: ${game.name}`, error);
  }
}

/**
 * Enrich multiple games with rate limiting
 * @param {Array} games - Array of game documents
 * @param {string} context - Context for logging
 * @returns {Promise<number>} Number of enriched games
 */
async function enrichGamesBatch(games, context = 'batch') {
  let enrichedCount = 0;

  for (const game of games) {
    try {
      const success = await enrichSingleGame(game);
      if (success) {
        enrichedCount++;
        console.log(`✅ ${context} enriched: ${game.name}`);
      }

      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      if (error.response?.status === 429) {
        console.log(`⚠️ Rate limited during ${context} enrichment, stopping...`);
        break;
      }
      console.warn(`⚠️ Failed to enrich ${game.name}:`, error.message);
    }
  }

  console.log(`📊 ${context} enrichment complete: ${enrichedCount}/${games.length} games enriched`);
  return enrichedCount;
}

/**
 * Restore failed games back to unenriched state
 * @returns {Promise<number>} Number of restored games
 */
async function restoreFailedGames() {
  try {
    const result = await Game.updateMany(
      { igdbId: -1 }, // Find failed games
      {
        $unset: { igdbId: 1 }, // Remove igdbId field
        $set: { lastUpdated: new Date() }
      }
    );

    console.log(`🔄 Restored ${result.modifiedCount} failed games for retry`);
    return result.modifiedCount;
  } catch (error) {
    console.error('Failed to restore failed games:', error);
    throw error;
  }
}

module.exports = {
  createOrUpdateFromIGDB,
  enrichSingleGame,
  enrichGamesBatch,
  restoreFailedGames,
  markGameAsFailed
};
