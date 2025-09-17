const Game = require('../models/Game');
const igdbService = require('./igdbService');

class GameService {
  // Normalize game names for consistent linking
  static normalizeGameName(name) {
    return Game.normalizeGameName(name);
  }

  // Create or update game from IGDB data
  static async createOrUpdateFromIGDB(igdbId, additionalData = {}) {
    try {
      // Check if game already exists
      let game = await Game.findOne({ igdbId });

      if (game) {
        // Update existing game
        Object.assign(game, additionalData);
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

  // Find game by name (with normalization)
  static async findByName(name) {
    const normalized = this.normalizeGameName(name);
    return await Game.findOne({ name: normalized });
  }

  // Get game by IGDB ID
  static async findByIgdbId(igdbId) {
    return await Game.findOne({ igdbId });
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
        const normalized = this.normalizeGameName(game.name);
        userGameMap.set(normalized, game);
      });

      const currentGameMap = new Map();
      currentGames.forEach(game => {
        currentGameMap.set(game.name, game);
      });

      // Find games to add ownership to
      const gamesToAdd = userGames.filter(game => {
        const normalized = this.normalizeGameName(game.name);
        return !currentGameMap.has(normalized);
      });

      // Find games to remove ownership from
      const gamesToRemove = currentGames.filter(game => {
        return !userGameMap.has(game.name);
      });

      // Bulk operations
      const bulkOps = [];

      // Add ownership to new games
      for (const userGame of gamesToAdd) {
        const normalized = this.normalizeGameName(userGame.name);
        bulkOps.push({
          updateOne: {
            filter: { name: normalized },
            update: {
              $addToSet: {
                owners: {
                  userId: userId,
                  platforms: [userGame.platform]
                }
              },
              $set: { lastUpdated: new Date() }
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
        removed: gamesToRemove.length
      };
    } catch (error) {
      console.error('Error syncing game ownership:', error);
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

  // Clean up games with no owners (optional maintenance)
  static async cleanupOrphanedGames() {
    const result = await Game.deleteMany({ owners: { $size: 0 } });
    return result.deletedCount;
  }
}

module.exports = GameService;
