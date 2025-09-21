/**
 * RetroAchievements Configuration
 * RetroAchievements API settings and constants
 */

module.exports = {
  // RetroAchievements API Configuration
  api: {
    username: process.env.RETROACHIEVEMENT_USERNAME,
    apiKey: process.env.RETROACHIEVEMENT_API_KEY,
    enabled: process.env.RETROACHIEVEMENT_ENABLED !== 'false'
  },

  // Request Configuration
  requests: {
    timeout: 30000, // 30 seconds
    retries: 3,
    retryDelay: 1000 // 1 second base delay
  },

  // Error Handling
  errors: {
    network: {
      timeout: 30000,
      retryDelay: 5000
    }
  }
};
