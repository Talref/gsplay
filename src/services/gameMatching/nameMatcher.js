/**
 * Name Matcher Utilities
 * Functions for creating regex patterns for game name matching
 */

/**
 * Create exact match regex for game names
 * @param {string} name - Game name
 * @returns {RegExp} Regex for exact case-insensitive match
 */
function createExactMatchRegex(name) {
  if (!name || typeof name !== 'string') {
    return new RegExp('^$', 'i');
  }

  // Escape special regex characters and create exact match
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Create flexible match regex for similar game names
 * @param {string} name - Game name
 * @returns {RegExp} Regex for flexible matching
 */
function createFlexibleMatchRegex(name) {
  if (!name || typeof name !== 'string') {
    return new RegExp('^$', 'i');
  }

  // Normalize the name for better matching
  const normalized = normalizeGameName(name);

  // Create flexible pattern that allows for variations
  // Replace spaces with flexible whitespace matching
  const flexible = normalized.replace(/\s+/g, '.*');

  return new RegExp(flexible, 'i');
}

/**
 * Normalize game name for consistent matching
 * @param {string} name - Game name to normalize
 * @returns {string} Normalized game name
 */
function normalizeGameName(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }

  return name
    // Convert to lowercase
    .toLowerCase()
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove common punctuation that might vary
    .replace(/['":;,.!?()-]/g, '')
    // Trim whitespace
    .trim();
}

/**
 * Check if two game names are similar
 * @param {string} name1 - First game name
 * @param {string} name2 - Second game name
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {boolean} True if names are similar
 */
function areNamesSimilar(name1, name2, threshold = 0.8) {
  if (!name1 || !name2) return false;

  const normalized1 = normalizeGameName(name1);
  const normalized2 = normalizeGameName(name2);

  if (normalized1 === normalized2) return true;

  // Simple similarity based on common characters
  const longer = normalized1.length > normalized2.length ? normalized1 : normalized2;
  const shorter = normalized1.length > normalized2.length ? normalized2 : normalized1;

  if (longer.length === 0) return true;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length >= threshold;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Extract potential game name variations
 * @param {string} name - Base game name
 * @returns {Array} Array of potential variations
 */
function getNameVariations(name) {
  if (!name || typeof name !== 'string') {
    return [];
  }

  const variations = [name];
  const normalized = normalizeGameName(name);

  // Add common variations
  variations.push(
    // Remove edition/year suffixes
    normalized.replace(/\s+\d{4}$/, ''),
    normalized.replace(/\s+edition$/i, ''),
    normalized.replace(/\s+deluxe$/i, ''),
    // Handle roman numerals
    normalized.replace(/\s+ii$/i, ' 2'),
    normalized.replace(/\s+iii$/i, ' 3'),
    normalized.replace(/\s+iv$/i, ' 4'),
    // Handle common abbreviations
    normalized.replace(/\bthe\b/i, '').trim()
  );

  // Remove duplicates and empty strings
  return [...new Set(variations)].filter(v => v && v.length > 0);
}

module.exports = {
  createExactMatchRegex,
  createFlexibleMatchRegex,
  normalizeGameName,
  areNamesSimilar,
  levenshteinDistance,
  getNameVariations
};
