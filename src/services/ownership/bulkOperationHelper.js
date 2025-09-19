/**
 * Bulk Operation Helper
 * Utilities for creating and executing bulk database operations
 */

const Game = require('../../models/Game');

/**
 * Create upsert operation for game ownership
 * @param {string} gameName - Name of the game
 * @param {string} userId - User ID
 * @param {string} platform - Platform name
 * @returns {Object} MongoDB upsert operation
 */
function createGameOwnershipUpsert(gameName, userId, platform) {
  return {
    updateOne: {
      filter: { name: gameName },
      update: {
        $setOnInsert: {
          name: gameName,
          createdAt: new Date()
        },
        $set: {
          lastUpdated: new Date()
        },
        $push: {
          owners: {
            userId: userId,
            platforms: [platform]
          }
        }
      },
      upsert: true
    }
  };
}

/**
 * Create ownership removal operation
 * @param {string} gameId - Game document ID
 * @param {string} userId - User ID
 * @returns {Object} MongoDB update operation
 */
function createOwnershipRemoval(gameId, userId) {
  return {
    updateOne: {
      filter: { _id: gameId },
      update: {
        $pull: { owners: { userId: userId } },
        $set: { lastUpdated: new Date() }
      }
    }
  };
}

/**
 * Execute bulk operations with error handling
 * @param {Array} operations - Array of MongoDB operations
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Bulk operation result
 */
async function executeBulkOperations(operations, options = {}) {
  const {
    ordered = true,
    bypassDocumentValidation = false
  } = options;

  if (!operations || operations.length === 0) {
    return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
  }

  try {
    const result = await Game.bulkWrite(operations, {
      ordered,
      bypassDocumentValidation
    });

    console.log(`📊 Bulk operation completed: ${result.modifiedCount} modified, ${result.upsertedCount} upserted`);
    return result;
  } catch (error) {
    console.error('Bulk operation failed:', error);
    throw error;
  }
}

/**
 * Create bulk operations for game ownership sync
 * @param {string} userId - User ID
 * @param {Array} gamesToAdd - Games to add ownership to
 * @param {Array} gamesToRemove - Games to remove ownership from
 * @returns {Array} Bulk operations array
 */
function createBulkOwnershipOperations(userId, gamesToAdd, gamesToRemove) {
  const operations = [];

  // Add ownership operations
  gamesToAdd.forEach(game => {
    operations.push(createGameOwnershipUpsert(game.name, userId, game.platform));
  });

  // Remove ownership operations
  gamesToRemove.forEach(game => {
    operations.push(createOwnershipRemoval(game._id, userId));
  });

  return operations;
}

/**
 * Generic bulk update operation creator
 * @param {Object} filter - MongoDB filter
 * @param {Object} update - MongoDB update operation
 * @param {Object} options - Operation options
 * @returns {Object} Bulk operation
 */
function createBulkUpdateOperation(filter, update, options = {}) {
  const { upsert = false } = options;

  return {
    updateOne: {
      filter,
      update: {
        ...update,
        $set: {
          ...update.$set,
          lastUpdated: new Date()
        }
      },
      upsert
    }
  };
}

/**
 * Create bulk update operations for multiple documents
 * @param {Array} updates - Array of {filter, update, options}
 * @returns {Array} Bulk operations array
 */
function createBulkUpdateOperations(updates) {
  return updates.map(({ filter, update, options = {} }) =>
    createBulkUpdateOperation(filter, update, options)
  );
}

module.exports = {
  createGameOwnershipUpsert,
  createOwnershipRemoval,
  executeBulkOperations,
  createBulkOwnershipOperations,
  createBulkUpdateOperation,
  createBulkUpdateOperations
};
