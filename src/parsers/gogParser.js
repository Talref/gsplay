// src/utils/parsers/gogParser.js

/**
 * Parse GOG library JSON and return an array of games in standard format
 * @param {Array} data - Raw parsed JSON from GOG export
 * @returns {Array} - Array of games { name, platform, platformId }
 */
async function parseGog(data) {
  if (!Array.isArray(data)) {
    throw new Error('Expected an array of games from GOG JSON');
  }

  const games = data.map(game => {
    if (!game.title || !game.app_name) {
      // skip malformed entries
      return null;
    }

    return {
      name: game.title,
      platform: 'gog',
      platformId: game.app_name.toString(), // convert to string just in case
    };
  }).filter(Boolean); // remove nulls

  return games;
}

module.exports = parseGog;
