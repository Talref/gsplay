// src/utils/formatters.js

/**
 * Formats a game title for use in a URL, typically for IGDB.
 * @param {string} name The original game title.
 * @returns {string} The URL-friendly formatted title.
 */
export const gameTitleFormatter = (name) => {
  if (!name) {
    return '';
  }

  let formattedTitle = name.toLowerCase();
  formattedTitle = formattedTitle.replace(/\s*-\s*/g, '-');
  formattedTitle = formattedTitle.replace(/[^a-z0-9\s-]/g, '').trim();
  formattedTitle = formattedTitle.replace(/\s+/g, '-');

  return formattedTitle;
};

/**
 * Filters platforms to only show curated ones for better UX
 * Groups PC platforms (Windows, Linux, Mac) under single "PC" category
 * @param {string[]} platforms - Array of platform names
 * @returns {string[]} Filtered and grouped platform names
 */
export const filterPlatforms = (platforms) => {
  if (!platforms || !Array.isArray(platforms)) {
    return [];
  }

  // Curated platforms we want to show
  const curatedPlatforms = [
    'PC (Microsoft Windows)', // IGDB's exact name for PC
    'Linux',
    'Mac', // IGDB calls macOS this
    'PlayStation 4',
    'PlayStation 5',
    'Xbox One',
    'Xbox Series X|S', // IGDB uses | not /
    'Xbox', // Generic Xbox
    'Nintendo Switch',
    'Nintendo Switch 2' // Future-proofing
  ];

  // Filter to only include curated platforms that exist in the game's platforms
  let availablePlatforms = curatedPlatforms.filter(platform =>
    platforms.includes(platform)
  );

  // Group PC platforms under single "PC" category for better UX
  const pcPlatforms = ['PC (Microsoft Windows)', 'Linux', 'Mac'];
  const hasAnyPcPlatform = pcPlatforms.some(platform => availablePlatforms.includes(platform));

  if (hasAnyPcPlatform) {
    // Remove individual PC platforms and add unified "PC" category
    availablePlatforms = availablePlatforms.filter(platform => !pcPlatforms.includes(platform));
    availablePlatforms.unshift('PC'); // Add PC at the beginning
  }

  return availablePlatforms;
};

/**
 * Groups owners by user ID and merges their platforms
 * @param {Array} owners - Array of owner objects
 * @returns {Array} Grouped owners with merged platforms
 */
export const groupOwnersByUser = (owners) => {
  if (!owners || !Array.isArray(owners)) {
    return [];
  }

  const groupedOwners = new Map();

  owners.forEach(owner => {
    const userId = owner.userId?._id || owner.userId;
    const userName = owner.userId?.name || owner.name || 'Unknown User';

    if (groupedOwners.has(userId)) {
      // Merge platforms for existing user
      const existingOwner = groupedOwners.get(userId);
      const mergedPlatforms = [...new Set([...existingOwner.platforms, ...owner.platforms])];
      existingOwner.platforms = mergedPlatforms;
    } else {
      // Add new user
      groupedOwners.set(userId, {
        userId: userId,
        name: userName,
        platforms: [...owner.platforms]
      });
    }
  });

  return Array.from(groupedOwners.values());
};

/**
 * Gets the platform icon path for a given platform name
 * @param {string} platform - Platform name
 * @returns {string} Icon path or null if not found
 */
export const getPlatformIcon = (platform) => {
  if (!platform) return null;

  const platformIconMap = {
    'steam': '/steam.png',
    'epic': '/epic.png',
    'gog': '/gog.png',
    'amazon': '/amazon.png',
    'procio': '/procio.png',
    // Add more platform mappings as needed
  };

  // Try exact match first
  const lowerPlatform = platform.toLowerCase();
  if (platformIconMap[lowerPlatform]) {
    return platformIconMap[lowerPlatform];
  }

  // Try partial matches
  for (const [key, icon] of Object.entries(platformIconMap)) {
    if (lowerPlatform.includes(key) || key.includes(lowerPlatform)) {
      return icon;
    }
  }

  return null;
};
