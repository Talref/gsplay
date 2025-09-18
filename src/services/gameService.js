const Game = require('../models/Game');
const igdbService = require('./igdbService');

/**
 * Service class for managing game data and IGDB integration
 */
class GameService {
  // Game names are stored exactly as provided by platform APIs
  // No normalization needed - we use case-insensitive regex matching instead

  /**
   * Create or update game from IGDB data
   * @param {number} igdbId - IGDB game ID
   * @param {Object} additionalData - Additional game data from IGDB
   * @param {Object} targetGame - Specific game document to update (prevents cross-contamination)
   * @returns {Promise<Object>} Updated game document
   */
  static async createOrUpdateFromIGDB(igdbId, additionalData = {}, targetGame = null) {
    try {
      // If we have a specific target game to update, use it first
      if (targetGame) {
        console.log(`🎯 Updating target game: "${targetGame.name}" (ID: ${targetGame._id})`);
        const updateData = { igdbId, ...additionalData };
        delete updateData.name; // Don't overwrite the existing name

        Object.assign(targetGame, updateData);
        targetGame.lastUpdated = new Date();
        return await targetGame.save();
      }

      // Fallback: First try to find by IGDB ID
      let game = await Game.findOne({ igdbId });

      if (!game && additionalData.name) {
        // If not found by IGDB ID, try to find by exact name match (case-insensitive)
        game = await Game.findOne({
          name: { $regex: `^${additionalData.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
        });

        // If still not found, try a broader search for similar games
        if (!game) {
          // Look for games with similar names using flexible regex
          const similarGames = await Game.find({
            name: { $regex: additionalData.name.replace(/\s+/g, '.*'), $options: 'i' },
            owners: { $exists: true, $ne: [] }
          }).limit(5);

          // Find the best match (exact match first, then highest owner count)
          if (similarGames.length > 0) {
            const exactMatch = similarGames.find(g =>
              g.name.toLowerCase() === additionalData.name.toLowerCase()
            );
            game = exactMatch || similarGames[0];
            console.log(`🔗 Matched similar game: "${game.name}" for IGDB: "${additionalData.name}"`);
          }
        }
      }

      if (game) {
        // Update existing game - be careful not to overwrite the name
        const updateData = { igdbId, ...additionalData };
        delete updateData.name; // Don't overwrite the existing name

        Object.assign(game, updateData);
        game.lastUpdated = new Date();
        return await game.save();
      } else {
        // Create new game
        const gameData = {
          igdbId,
          ...additionalData,
          lastUpdated: new Date(),
          createdAt: new Date()
        };
        return await Game.create(gameData);
      }
    } catch (error) {
      console.error('Error creating/updating game from IGDB:', error);
      throw error;
    }
  }

  /**
   * Generic game finder with multiple criteria
   * @param {Object} criteria - MongoDB query criteria
   * @returns {Promise<Object|null>} Game document or null
   */
  static async findGame(criteria) {
    return await Game.findOne(criteria);
  }

  // Search games with filters (for game database page)
  static async searchGames(options = {}) {
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

  // Get game details with owner information
  static async getGameDetails(gameId) {
    return await Game.findById(gameId)
      .populate('owners.userId', 'name');
  }

  // Sync game ownership when user adds/removes games
  // This updates the Game model's owners array
  static async syncGameOwnership(userId, userGames) {
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

      // Don't remove ownership - scan only adds games, doesn't manage ownership
      const gamesToRemove = [];

      // Bulk operations
      const bulkOps = [];

      // Add ownership to new games
      for (const userGame of gamesToAdd) {
        bulkOps.push({
          updateOne: {
            filter: { name: userGame.name },
            update: {
              $setOnInsert: {
                name: userGame.name,
                createdAt: new Date()
              },
              $set: {
                lastUpdated: new Date()
              },
              $push: {
                owners: {
                  userId: userId,
                  platforms: [userGame.platform]
                }
              }
            },
            upsert: true // Create if doesn't exist
          }
        });
      }

      // Remove ownership from games user no longer owns
      for (const game of gamesToRemove) {
        bulkOps.push({
          updateOne: {
            filter: { _id: game._id },
            update: {
              $pull: { owners: { userId: userId } },
              $set: { lastUpdated: new Date() }
            }
          }
        });
      }

      if (bulkOps.length > 0) {
        await Game.bulkWrite(bulkOps);
      }

      // Attempt immediate IGDB enrichment for newly added games
      let enrichedCount = 0; // Declare at function scope
      if (gamesToAdd.length > 0) {
        console.log(`🎯 Attempting IGDB enrichment for ${gamesToAdd.length} new games...`);

        // Fetch the actual Mongoose documents created by bulkWrite
        // bulkWrite returns plain objects, but we need Mongoose documents for enrichment
        const gameNames = gamesToAdd.map(game => game.name);

        const gameDocuments = await Game.find({
          name: { $in: gameNames }
        });

        console.log(`📋 Retrieved ${gameDocuments.length} Mongoose documents for enrichment`);

        // Use the reusable batch enrichment method with actual documents
        enrichedCount = await this.enrichGamesBatch(gameDocuments, 'user-sync');
      }

      return {
        success: true,
        added: gamesToAdd.length,
        removed: gamesToRemove.length,
        enriched: enrichedCount
      };
    } catch (error) {
      console.error('Error syncing game ownership:', error);
      throw error;
    }
  }

  // Add games to database without enrichment (for admin scan)
  static async addGamesToDatabase(userId, userGames) {
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

      // Don't remove ownership - scan only adds games, doesn't manage ownership
      const gamesToRemove = [];

      // Bulk operations
      const bulkOps = [];

      // Add ownership to new games
      for (const userGame of gamesToAdd) {
        bulkOps.push({
          updateOne: {
            filter: { name: userGame.name },
            update: {
              $setOnInsert: {
                name: userGame.name,
                createdAt: new Date()
              },
              $set: {
                lastUpdated: new Date()
              },
              $push: {
                owners: {
                  userId: userId,
                  platforms: [userGame.platform]
                }
              }
            },
            upsert: true // Create if doesn't exist
          }
        });
      }

      // Remove ownership from games user no longer owns
      for (const game of gamesToRemove) {
        bulkOps.push({
          updateOne: {
            filter: { _id: game._id },
            update: {
              $pull: { owners: { userId: userId } },
              $set: { lastUpdated: new Date() }
            }
          }
        });
      }

      if (bulkOps.length > 0) {
        await Game.bulkWrite(bulkOps);
      }

      return {
        success: true,
        added: gamesToAdd.length,
        removed: gamesToRemove.length,
        enriched: 0 // No enrichment in this function
      };
    } catch (error) {
      console.error('Error adding games to database:', error);
      throw error;
    }
  }

  // Get game statistics for dashboard
  static async getGameStats() {
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

  // Find games that need IGDB enrichment
  static async findUnenrichedGames(limit = 100) {
    const games = await Game.find({
      $and: [
        {
          $or: [
            { igdbId: { $exists: false } }, // Never had igdbId field
            { igdbId: null }, // igdbId field exists but is null
            { igdbId: 0 } // igdbId exists but is 0 (edge case)
          ]
        },
        { igdbId: { $ne: -1 } } // Exclude failed enrichments
      ],
      owners: { $exists: true, $ne: [] }
    })
    .limit(limit)
    .sort({ createdAt: -1 });

    console.log(`📊 Found ${games.length} unenriched games`);
    return games;
  }

  // Find games that failed IGDB enrichment (for analytics/future corrections)
  static async findFailedEnrichments(limit = 50) {
    const games = await Game.find({
      igdbId: -1, // Failed enrichment sentinel value
      owners: { $exists: true, $ne: [] }
    })
    .limit(limit)
    .sort({ createdAt: -1 });

    console.log(`📊 Found ${games.length} failed enrichment games`);
    return games;
  }

  // Reusable enrichment method for individual games
  static async enrichSingleGame(game) {
    try {
      // Use the original game name from database for IGDB search
      const searchName = game.name;
      console.log(`🔍 Searching IGDB for: "${searchName}"`);
      const igdbResults = await igdbService.searchGames(searchName, 1);

      if (igdbResults.length > 0) {
        const igdbGame = igdbResults[0];
        console.log(`📋 Found IGDB match: "${igdbGame.name}" (ID: ${igdbGame.id})`);
        const details = await igdbService.getGameDetails(igdbGame.id);

        if (details) {
          // Use the IGDB data but keep the original game name from database
          console.log(`📝 Updating game "${game.name}" with IGDB ID ${igdbGame.id}`);
          const updatedGame = await this.createOrUpdateFromIGDB(igdbGame.id, {
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
          }, game); // Pass the target game to ensure we update the correct record

          console.log(`✅ Successfully updated game: ${updatedGame.name} (igdbId: ${updatedGame.igdbId})`);
          return true; // Successfully enriched
        }
      } else {
        console.log(`❌ No IGDB results found for: "${searchName}"`);
        // Mark as failed to prevent infinite retries
        await this.markGameAsFailed(game);
        console.log(`🚫 Game marked as failed enrichment: "${game.name}"`);
      }

      return false; // No enrichment data found

    } catch (error) {
      console.warn(`⚠️ Failed to enrich ${game.name}:`, error.message);
      // Mark as failed to prevent infinite retries
      await this.markGameAsFailed(game);
      console.log(`🚫 Game marked as failed enrichment: "${game.name}"`);
      return false; // Enrichment failed
    }
  }

  // Mark a game as failed enrichment to prevent infinite retries
  static async markGameAsFailed(game) {
    try {
      game.igdbId = -1; // Sentinel value for failed enrichment
      game.lastUpdated = new Date();
      await game.save();
      console.log(`🚫 Marked "${game.name}" as failed enrichment (igdbId: -1)`);
    } catch (error) {
      console.error(`Failed to mark game as failed: ${game.name}`, error);
    }
  }

  // Batch enrichment with rate limiting
  static async enrichGamesBatch(games, context = 'batch') {
    let enrichedCount = 0;

    for (const game of games) {
      try {
        const success = await this.enrichSingleGame(game);
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

  // Restore failed games back to unenriched state for retry
  static async restoreFailedGames() {
    try {
      const result = await Game.updateMany(
        { igdbId: -1 }, // Find failed games
        {
          $unset: { igdbId: 1 }, // Remove igdbId field (sets to undefined)
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

}

module.exports = GameService;
