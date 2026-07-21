const { buildAuthorization, getUserProfile, getGameExtended, getGameInfoAndUserProgress } = require('@retroachievements/api');

class RetroAchievementsProviderError extends Error {
  constructor(message) { super(message); this.name = 'RetroAchievementsProviderError'; }
}

function createRetroAchievementsClient({ username, apiKey, api = { buildAuthorization, getUserProfile, getGameExtended, getGameInfoAndUserProgress } }) {
  if (!username || !apiKey) throw new RetroAchievementsProviderError('RetroAchievements service credentials are not configured');
  const authorization = api.buildAuthorization({ username, webApiKey: apiKey });
  return {
    async getProfile(profileUsername) {
      try { return await api.getUserProfile(authorization, { username: profileUsername }); } catch { throw new RetroAchievementsProviderError('RetroAchievements profile request failed'); }
    },
    async getGame(gameId) {
      try { return await api.getGameExtended(authorization, { gameId }); } catch { throw new RetroAchievementsProviderError('RetroAchievements game request failed'); }
    },
    async getGameProgress(gameId, profileUsername) {
      try { return await api.getGameInfoAndUserProgress(authorization, { gameId, username: profileUsername }); } catch { throw new RetroAchievementsProviderError('RetroAchievements progress request failed'); }
    }
  };
}

module.exports = { createRetroAchievementsClient, RetroAchievementsProviderError };