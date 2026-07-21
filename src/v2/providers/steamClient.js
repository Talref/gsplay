const axios = require('axios');

class SteamProviderError extends Error {
  constructor(message, retryable = false) { super(message); this.name = 'SteamProviderError'; this.retryable = retryable; }
}

function createSteamClient({ apiKey, http = axios }) {
  if (!apiKey) throw new SteamProviderError('STEAM_API_KEY is not configured');
  return {
    async listOwnedGames(steamId) {
      if (!/^\d{17}$/.test(String(steamId))) throw new SteamProviderError('Steam ID must be a 17-digit SteamID64');
      try {
        const response = await http.get('https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/', { params: { key: apiKey, steamid: steamId, include_appinfo: 1, include_played_free_games: 1 }, timeout: 10_000 });
        const games = response.data?.response?.games;
        if (!Array.isArray(games)) return [];
        return games.filter((game) => Number.isInteger(game.appid) && typeof game.name === 'string' && game.name.trim()).map((game) => ({ providerGameId: String(game.appid), providerTitle: game.name.trim() }));
      } catch (error) {
        const retryable = !error.response || error.response.status >= 500 || error.response.status === 429;
        throw new SteamProviderError('Steam library request failed', retryable);
      }
    }
  };
}
module.exports = { createSteamClient, SteamProviderError };