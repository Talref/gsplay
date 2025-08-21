// src/parsers/dispatcher.js

const gogParser = require('./gogParser');
const epicParser = require('./epicParser');
const amazonParser = require('./amazonParser');
const fs = require('fs').promises;
const path = require('path');

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

async function dispatcher(file) {
  if (!file || !file.originalname || !file.path) {
    throw new Error('No file provided');
  }

  // Security: check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large (max 2MB)');
  }

  // Security: check file extension
  if (path.extname(file.originalname).toLowerCase() !== '.json') {
    throw new Error('Invalid file type, must be JSON');
  }

  // Read and parse file safely
  let data;
  try {
    const fileContent = await fs.readFile(file.path, 'utf-8');
    data = JSON.parse(fileContent);
  } catch (err) {
    throw new Error('Invalid JSON file');
  }

  // Decide which parser to call based on filename
  const filename = file.originalname.toLowerCase();
  if (filename.includes('gog')) {
    return await gogParser(data);
  } else if (filename.includes('epic') || filename.includes('legendary')) {
    return await epicParser(data);
  } else if (filename.includes('amazon') || filename.includes('nile')) {
    return await amazonParser(data);
  } else {
    throw new Error('Unrecognized file name. Cannot determine platform');
  }
}

module.exports = dispatcher;
