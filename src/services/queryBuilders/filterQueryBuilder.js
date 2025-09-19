/**
 * Filter Query Builder
 * Handles filter options and validation for game searches
 */

const Game = require('../../models/Game');
const { platforms: platformConfig } = require('../../../config/games');

/**
 * Get available filter options for games
 * @returns {Promise<Object>} Filter options object
 */
async function getFilterOptions() {
  try {
    // Get distinct values for filters from database
    const [genres, allPlatforms, gameModes] = await Promise.all([
      Game.distinct('genres'),
      Game.distinct('availablePlatforms'),
      Game.distinct('gameModes')
    ]);

    // Filter platforms to only include supported ones that exist in database
    let availablePlatforms = platformConfig.supported.filter(platform =>
      allPlatforms.includes(platform)
    );

    // Group PC platforms under single "PC" category for better UX
    const pcPlatforms = platformConfig.groups.pc;
    const hasAnyPcPlatform = pcPlatforms.some(platform => availablePlatforms.includes(platform));

    if (hasAnyPcPlatform) {
      // Remove individual PC platforms and add unified "PC" category
      availablePlatforms = availablePlatforms.filter(platform => !pcPlatforms.includes(platform));
      availablePlatforms.unshift('PC'); // Add PC at the beginning
    }

    // Filter out null/undefined values and sort
    const filterOptions = {
      genres: genres.filter(Boolean).sort(),
      platforms: availablePlatforms.sort(),
      gameModes: gameModes.filter(Boolean).sort()
    };

    return filterOptions;

  } catch (error) {
    console.error('Filter options error:', error);
    throw new Error('Failed to get filter options');
  }
}

/**
 * Expand platform filters (handle PC category expansion)
 * @param {Array|string} platforms - Platform filters
 * @returns {Array} Expanded platform array
 */
function expandPlatformFilters(platforms) {
  if (!platforms || platforms.length === 0) {
    return [];
  }

  let platformArray = Array.isArray(platforms) ? platforms : [platforms];

  // Expand "PC" category to include all PC platforms
  if (platformArray.includes('PC')) {
    const pcPlatforms = ['PC (Microsoft Windows)', 'Linux', 'Mac'];
    // Replace "PC" with actual PC platforms, and keep any other selected platforms
    platformArray = platformArray.filter(p => p !== 'PC').concat(pcPlatforms);
  }

  return platformArray;
}

/**
 * Validate filter parameters
 * @param {Object} params - Filter parameters to validate
 * @returns {Object} Validation result
 */
function validateFilterParams(params) {
  const errors = [];
  const validated = {};

  // Validate genres
  if (params.genres) {
    const genres = Array.isArray(params.genres) ? params.genres : [params.genres];
    validated.genres = genres.filter(g => g && typeof g === 'string');
  }

  // Validate platforms
  if (params.platforms) {
    const platforms = Array.isArray(params.platforms) ? params.platforms : [params.platforms];
    validated.platforms = platforms.filter(p => p && typeof p === 'string');
  }

  // Validate gameModes
  if (params.gameModes) {
    const gameModes = Array.isArray(params.gameModes) ? params.gameModes : [params.gameModes];
    validated.gameModes = gameModes.filter(m => m && typeof m === 'string');
  }

  return {
    isValid: errors.length === 0,
    errors,
    validated
  };
}

/**
 * Sanitize filter input
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeFilterInput(input) {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove potentially dangerous characters and trim
  return input.replace(/[<>\"'&]/g, '').trim();
}

module.exports = {
  getFilterOptions,
  expandPlatformFilters,
  validateFilterParams,
  sanitizeFilterInput
};
