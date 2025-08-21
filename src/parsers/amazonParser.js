// src/utils/parsers/amazonParser.js

/**
 * Parse Amazon Games library JSON and return an array of games in standard format
 * @param {Array} data - Raw parsed JSON from Amazon export
 * @returns {Array} - Array of games { name, platform, platformId }
 */
async function parseAmazon(data) {
  if (!Array.isArray(data.library)) {
    throw new Error('Expected an array of games from Amazon JSON');
  }

  const games = data.library.map(game => {
    if (!game.title || !game.app_name) {
      // skip malformed entries
      return null;
    }

    return {
      name: game.title,
      platform: 'amazon',
      platformId: game.app_name.toString(),
    };
  }).filter(Boolean); // remove nulls

  return games;
}

module.exports = parseAmazon;