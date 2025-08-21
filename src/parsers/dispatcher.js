// src/utils/dispatcher.js

const parseGog = require('./gogParser.js');
const parseEpic = require('./epicParser.js');
const parseAmazon = require('./amazonParser.js');

/**
 * Dispatch the file content to the correct parser based on filename
 * @param {string} fileContent - Raw JSON string from the uploaded file
 * @param {string} filename - Original filename uploaded by the user
 * @returns {Promise<Array>} - Array of game objects { name, platform, platformId }
 */
async function dispatcher(fileContent, filename) {
  // Normalize filename for easier matching
  const lowerName = filename.toLowerCase();

  let parser;

  if (lowerName.includes('gog')) {
    parser = parseGog;
  } else if (lowerName.includes('legendary')) {
    parser = parseEpic;
  } else if (lowerName.includes('nile')) {
    parser = parseAmazon;
  } else {
    throw new Error('Unknown platform: cannot determine parser from filename');
  }

  let data;
  try {
    data = JSON.parse(fileContent);
  } catch (err) {
    throw new Error('Invalid JSON file');
  }

  // Each parser returns an array of games in the correct format
  const games = await parser(data);
  
  if (!Array.isArray(games)) {
    throw new Error('Parser did not return a valid array of games');
  }

  return games;
}

module.exports = dispatcher;
