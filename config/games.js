/**
 * Games Configuration
 * Game-related settings, platform lists, and search parameters
 */

module.exports = {
  // Platform Configuration
  platforms: {
    // Curated list of platforms supported by the application
    supported: [
      'PC (Microsoft Windows)',
      'Linux',
      'Mac',
      'PlayStation 4',
      'PlayStation 5',
      'Xbox One',
      'Xbox Series X|S',
      'Xbox',
      'Nintendo Switch',
      'Nintendo Switch 2'
    ],

    // Platform groupings for better UX
    groups: {
      pc: ['PC (Microsoft Windows)', 'Linux', 'Mac'],
      playstation: ['PlayStation 4', 'PlayStation 5'],
      xbox: ['Xbox One', 'Xbox Series X|S', 'Xbox'],
      nintendo: ['Nintendo Switch', 'Nintendo Switch 2']
    },

    // Platform display names
    displayNames: {
      'PC (Microsoft Windows)': 'PC',
      'Linux': 'Linux',
      'Mac': 'macOS',
      'PlayStation 4': 'PS4',
      'PlayStation 5': 'PS5',
      'Xbox One': 'Xbox One',
      'Xbox Series X|S': 'Xbox Series X/S',
      'Xbox': 'Xbox',
      'Nintendo Switch': 'Switch',
      'Nintendo Switch 2': 'Switch 2'
    },

    // Platform icons/assets mapping
    icons: {
      'PC (Microsoft Windows)': 'steam.png',
      'Linux': 'steam.png',
      'Mac': 'steam.png',
      'PlayStation 4': 'ps4.png',
      'PlayStation 5': 'ps5.png',
      'Xbox One': 'xbox.png',
      'Xbox Series X|S': 'xbox.png',
      'Xbox': 'xbox.png',
      'Nintendo Switch': 'switch.png',
      'Nintendo Switch 2': 'switch.png'
    }
  },

  // Search Configuration
  search: {
    defaultLimit: 20,
    maxLimit: 100,
    minQueryLength: 1,
    maxQueryLength: 100,

    // Sort options
    sortOptions: {
      name: { field: 'name', order: 1 },
      rating: { field: 'rating', order: -1 },
      releaseDate: { field: 'releaseDate', order: -1 },
      ownerCount: { field: 'ownerCount', order: -1 },
      createdAt: { field: 'createdAt', order: -1 }
    },

    // Default sort
    defaultSort: {
      field: 'name',
      order: 1
    }
  },

  // Pagination Configuration
  pagination: {
    defaultPage: 1,
    defaultLimit: 20,
    maxLimit: 100,
    pageLinksCount: 5 // Number of page links to show
  },

  // Game Enrichment Configuration
  enrichment: {
    enabled: process.env.ENABLE_GAME_ENRICHMENT !== 'false',
    batchSize: 10,
    delayBetweenBatches: 1000, // 1 second
    maxRetries: 3,
    retryDelay: 2000, // 2 seconds
    failedThreshold: 5
  },

  // Game Statistics Configuration
  stats: {
    cacheTtl: 300, // 5 minutes
    aggregationPipeline: [
      {
        $group: {
          _id: null,
          totalGames: { $sum: 1 },
          totalOwners: { $sum: { $size: '$owners' } },
          avgRating: { $avg: '$rating' },
          genres: { $addToSet: '$genres' },
          platforms: { $addToSet: '$availablePlatforms' }
        }
      }
    ]
  },

  // Game Validation Rules
  validation: {
    name: {
      minLength: 1,
      maxLength: 200,
      required: true
    },
    description: {
      maxLength: 2000,
      required: false
    },
    rating: {
      min: 0,
      max: 100,
      required: false
    },
    releaseDate: {
      format: 'ISO8601',
      required: false
    }
  },

  // Game Display Configuration
  display: {
    maxDescriptionLength: 300,
    maxGenresToShow: 3,
    maxPlatformsToShow: 3,
    imageSizes: {
      thumbnail: 't_thumb',
      cover: 't_cover_big',
      screenshot: 't_screenshot_med'
    },
    defaultImage: '/placeholder-game.jpg'
  },

  // Ownership Configuration
  ownership: {
    maxGamesPerUser: 1000,
    syncBatchSize: 50,
    ownershipCacheTtl: 600, // 10 minutes
    allowMultipleOwnership: false // One user can own a game only once
  },

  // Import/Export Configuration
  import: {
    supportedFormats: ['json'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    batchSize: 25,
    validateBeforeImport: true,
    skipDuplicates: true
  },

  // Cache Configuration
  cache: {
    gameDetailsTtl: 3600, // 1 hour
    searchResultsTtl: 300, // 5 minutes
    statsTtl: 600, // 10 minutes
    maxCacheSize: 1000
  }
};
