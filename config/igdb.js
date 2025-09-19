/**
 * IGDB Configuration
 * IGDB API settings and constants
 */

module.exports = {
  // IGDB API Configuration
  api: {
    baseUrl: 'https://api.igdb.com/v4',
    tokenUrl: 'https://id.twitch.tv/oauth2/token',
    clientId: process.env.TW_CLIENTID,
    clientSecret: process.env.TW_CLIENTSECRET,
    tokenRefreshBuffer: 5 * 60 * 1000, // 5 minutes before expiry
    tokenExpiry: 50 * 24 * 60 * 60 * 1000 // 50 days (Twitch tokens last 60 days)
  },

  // Request Configuration
  requests: {
    defaultLimit: 5,
    maxLimit: 500,
    rateLimitDelay: 200, // ms between requests
    timeout: 30000, // 30 seconds
    retries: 3,
    retryDelay: 1000 // 1 second base delay
  },

  // Data Enrichment Configuration
  enrichment: {
    enabled: process.env.ENABLE_IGDB_ENRICHMENT !== 'false',
    batchSize: 10, // Games to enrich in one batch
    maxRetries: 3,
    retryDelay: 2000, // 2 seconds between retries
    failedThreshold: 5 // Mark as failed after this many attempts
  },

  // Cache Configuration
  cache: {
    enabled: true,
    ttl: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxSize: 10000 // Maximum cached items
  },

  // Lookup Tables Configuration
  lookups: {
    refreshInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
    batchSize: 500, // Items per batch when fetching
    requiredTables: ['genres', 'platforms', 'gameModes']
  },

  // Search Configuration
  search: {
    minQueryLength: 2,
    maxQueryLength: 100,
    defaultSort: 'rating desc',
    fuzzyMatching: true,
    boostExactMatches: true
  },

  // Field Mappings
  fields: {
    game: [
      'name', 'id', 'rating', 'cover.image_id', 'first_release_date',
      'genres', 'platforms', 'game_modes', 'videos.video_id',
      'summary', 'involved_companies.company.name', 'url'
    ],
    genre: ['id', 'name'],
    platform: ['id', 'name'],
    gameMode: ['id', 'name']
  },

  // Error Handling
  errors: {
    rateLimit: {
      retryAfter: 60, // seconds
      maxRetries: 3
    },
    network: {
      timeout: 30000,
      retryDelay: 5000
    },
    auth: {
      refreshThreshold: 300000 // 5 minutes before expiry
    }
  }
};
