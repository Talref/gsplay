/**
 * Game Finder Utilities
 * Reusable functions for finding games in the database
 */

const Game = require('../../models/Game');
const { createExactMatchRegex, createFlexibleMatchRegex } = require('./nameMatcher');

/**
 * Find a game by name with flexible matching
 * @param {string} name - Game name to search for
 * @param {Object} options - Search options
 * @returns {Promise<Object|null>} Found game or null
 */
async function findGameByName(name, options = {}) {
  const {
    exactMatch = false,
    includeOwnedOnly = false,
    limit = 5
  } = options;

  try {
    let filter = {};

    if (exactMatch) {
      // Exact case-insensitive match
      filter.name = { $regex: createExactMatchRegex(name) };
    } else {
      // Flexible match for similar names
      filter.name = { $regex: createFlexibleMatchRegex(name), $options: 'i' };
    }

    // Optionally only include games that have owners
    if (includeOwnedOnly) {
      filter.owners = { $exists: true, $ne: [] };
    }

    // Only return enriched games (with IGDB data)
    filter.igdbId = { $exists: true, $ne: null, $ne: -1 };

    const games = await Game.find(filter)
      .limit(limit)
      .sort({ name: 1 });

    return games.length > 0 ? games[0] : null;

  } catch (error) {
    console.error('Error finding game by name:', error);
    throw error;
  }
}

/**
 * Find multiple games by criteria
 * @param {Object} criteria - MongoDB query criteria
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of found games
 */
async function findGamesByCriteria(criteria, options = {}) {
  const {
    limit = 20,
    skip = 0,
    sort = { name: 1 },
    populate = null
  } = options;

  try {
    let query = Game.find(criteria);

    if (populate) {
      query = query.populate(populate);
    }

    const games = await query
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    return games;

  } catch (error) {
    console.error('Error finding games by criteria:', error);
    throw error;
  }
}

/**
 * Find games that need IGDB enrichment
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of unenriched games
 */
async function findUnenrichedGames(options = {}) {
  const {
    limit = 100,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;

  const criteria = {
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
  };

  const sort = {};
  sort[sortBy] = sortOrder;

  return await findGamesByCriteria(criteria, {
    limit,
    sort,
    populate: null
  });
}

/**
 * Find games that failed IGDB enrichment
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of failed enrichment games
 */
async function findFailedEnrichments(options = {}) {
  const {
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;

  const criteria = {
    igdbId: -1, // Failed enrichment sentinel value
    owners: { $exists: true, $ne: [] }
  };

  const sort = {};
  sort[sortBy] = sortOrder;

  return await findGamesByCriteria(criteria, {
    limit,
    sort,
    populate: null
  });
}

/**
 * Find games owned by a specific user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of user's games
 */
async function findGamesByUser(userId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    sort = { name: 1 }
  } = options;

  const criteria = {
    'owners.userId': userId
  };

  return await findGamesByCriteria(criteria, {
    limit,
    skip,
    sort,
    populate: null
  });
}

/**
 * Generic game finder with multiple criteria
 * @param {Object} criteria - MongoDB query criteria
 * @returns {Promise<Object|null>} Game document or null
 */
async function findGame(criteria) {
  try {
    return await Game.findOne(criteria);
  } catch (error) {
    console.error('Error finding game:', error);
    throw error;
  }
}

module.exports = {
  findGameByName,
  findGamesByCriteria,
  findUnenrichedGames,
  findFailedEnrichments,
  findGamesByUser,
  findGame
};
