/**
 * Game Data Transformer
 * Handles transformation of game data for API responses
 */

/**
 * Transform game document for search results list
 * @param {Object} game - Game document from database
 * @returns {Object} Transformed game object
 */
function transformGameForList(game) {
  if (!game) return null;

  // Calculate owner count - use unique userIds only
  const ownerCount = game.owners ? new Set(game.owners.map(owner => owner.userId.toString())).size : 0;

  return {
    _id: game._id,
    name: game.name,
    genres: game.genres || [],
    availablePlatforms: game.availablePlatforms || [],
    gameModes: game.gameModes || [],
    rating: game.rating || null,
    artwork: game.artwork || null,
    releaseDate: game.releaseDate || null,
    ownerCount,
    // Remove owners array from response for privacy/list efficiency
    owners: undefined
  };
}

/**
 * Transform game document for detailed view
 * @param {Object} game - Game document from database
 * @returns {Object} Transformed game object with full details
 */
function transformGameForDetails(game) {
  if (!game) return null;

  // Transform owners data with user information
  const owners = game.owners ? game.owners.map(owner => ({
    userId: owner.userId._id,
    name: owner.userId.name,
    platforms: owner.platforms
  })) : [];

  // Calculate owner count - use unique userIds only
  const ownerCount = owners.length; // owners is already transformed to unique users

  return {
    _id: game._id,
    name: game.name,
    description: game.description || null,
    genres: game.genres || [],
    availablePlatforms: game.availablePlatforms || [],
    gameModes: game.gameModes || [],
    rating: game.rating || null,
    artwork: game.artwork || null,
    releaseDate: game.releaseDate || null,
    videos: game.videos || [],
    publishers: game.publishers || [],
    igdbUrl: game.igdbUrl || null,
    owners,
    ownerCount
  };
}

/**
 * Add owner count to game object
 * @param {Object} game - Game document
 * @returns {Object} Game with owner count added
 */
function addOwnerCount(game) {
  if (!game) return null;

  const ownerCount = game.owners ? game.owners.length : 0;
  return {
    ...game,
    ownerCount,
    // Optionally remove owners array for privacy
    owners: undefined
  };
}

/**
 * Sanitize game data for public response (remove sensitive/private data)
 * @param {Object} game - Game document
 * @returns {Object} Sanitized game object
 */
function sanitizeGameData(game) {
  if (!game) return null;

  const sanitized = { ...game };

  // Remove any sensitive fields that shouldn't be exposed
  delete sanitized.createdAt;
  delete sanitized.updatedAt;
  delete sanitized.__v;

  // Ensure owners array is not exposed in public responses
  if (sanitized.owners) {
    // For detailed views, keep transformed owners
    // For list views, remove entirely
    if (Array.isArray(sanitized.owners) && sanitized.owners.length > 0) {
      // Check if owners have been transformed (have name field)
      const hasTransformedOwners = sanitized.owners.some(owner => owner.name);
      if (!hasTransformedOwners) {
        // Remove owners array if not transformed
        delete sanitized.owners;
      }
    }
  }

  return sanitized;
}

/**
 * Transform multiple games for list view
 * @param {Array} games - Array of game documents
 * @returns {Array} Array of transformed games
 */
function transformGamesForList(games) {
  if (!Array.isArray(games)) return [];
  return games.map(transformGameForList).filter(Boolean);
}

/**
 * Transform multiple games for detailed view
 * @param {Array} games - Array of game documents
 * @returns {Array} Array of transformed games
 */
function transformGamesForDetails(games) {
  if (!Array.isArray(games)) return [];
  return games.map(transformGameForDetails).filter(Boolean);
}

module.exports = {
  transformGameForList,
  transformGameForDetails,
  addOwnerCount,
  sanitizeGameData,
  transformGamesForList,
  transformGamesForDetails
};
