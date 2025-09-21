const { buildAuthorization } = require('@retroachievements/api');
const retroAchievementsConfig = require('../../config/retroAchievements');

class RetroAchievementsService {
  constructor() {
    this.username = retroAchievementsConfig.api.username;
    this.apiKey = retroAchievementsConfig.api.apiKey;
    this.authorization = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Validate credentials are available
      if (!this.username || !this.apiKey) {
        throw new Error('RetroAchievements username and API key are required');
      }

      // Build authorization object using official package
      this.authorization = buildAuthorization({
        username: this.username,
        webApiKey: this.apiKey
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize RetroAchievements authorization:', error.message);
      throw new Error('Unable to authenticate with RetroAchievements API');
    }
  }

  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  async getUserProfile(username) {
    await this.ensureInitialized();
    const { getUserProfile } = require('@retroachievements/api');
    try {
      return await getUserProfile(this.authorization, { username });
    } catch (error) {
      console.error('Failed to get user profile:', error.message);
      throw error;
    }
  }

  async getUserGameRankAndScore(gameId, username) {
    await this.ensureInitialized();
    const { getUserGameRankAndScore } = require('@retroachievements/api');
    try {
      const result = await getUserGameRankAndScore(this.authorization, {
        gameId: parseInt(gameId),
        username
      });
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Failed to get user game rank and score:', error.message);
      throw error;
    }
  }

  async getGameInfoAndUserProgress(gameId, username) {
    await this.ensureInitialized();
    const { getGameInfoAndUserProgress } = require('@retroachievements/api');
    try {
      return await getGameInfoAndUserProgress(this.authorization, {
        gameId: parseInt(gameId),
        username
      });
    } catch (error) {
      console.error('Failed to get game info and user progress:', error.message);
      throw error;
    }
  }

  async getGameExtended(gameId) {
    await this.ensureInitialized();
    const { getGameExtended } = require('@retroachievements/api');
    try {
      return await getGameExtended(this.authorization, {
        gameId: parseInt(gameId)
      });
    } catch (error) {
      console.error('Failed to get extended game info:', error.message);
      throw error;
    }
  }
}

module.exports = new RetroAchievementsService();
