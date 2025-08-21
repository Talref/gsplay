// src/parsers/dispatcher.js

// Import individual parsers
const gogParser = require('./gogParser');
const epicParser = require('./epicParser');
const amazonParser = require('./amazonParser');

/**
 * Receives an uploaded file object (from multer)
 * Decides which parser to use based on the filename
 * Returns an array of games: { name, platform, platformId }[]
 */
async function dispatcher(file) {
  if (!file || !file.originalname) {
    throw new Error('No file provided');
  }

  const filename = file.originalname.toLowerCase();

  if (filename.includes('gog')) {
    return await gogParser(file);
  } else if (filename.includes('epic') || filename.includes('legendary')) {
    return await epicParser(file);
  } else if (filename.includes('amazon') || filename.includes('nile')) {
    return await amazonParser(file);
  } else {
    throw new Error('Unrecognized file name. Cannot determine platform');
  }
}

module.exports = dispatcher;
