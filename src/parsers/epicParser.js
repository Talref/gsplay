// src/utils/parsers/epicParser.js

/**
 * Parse Epic Games library JSON and return an array of games in standard format
 * @param {Array} data - Raw parsed JSON from Epic export
 * @returns {Array} - Array of games { name, platform, platformId }
 */
async function parseEpic(data) {
  if (!Array.isArray(data.library)) {
    throw new Error('Expected an array of games from Epic JSON');
  }

  const games = data.library.map(game => {
    // Only process the main game object, skipping DLCs
    // which are often included as separate entries in the list
    if (!game.title || !game.app_name) {
      // skip malformed entries
      return null;
    }

    return {
      name: game.title,
      platform: 'epic',
      platformId: game.app_name.toString(),
    };
  }).filter(Boolean); // remove nulls

  return games;
}

module.exports = parseEpic;