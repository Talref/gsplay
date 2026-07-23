const axios = require('axios');

class SteamProviderError extends Error {
  constructor(message, retryable = false, code = 'steam_request_failed') { super(message); this.name = 'SteamProviderError'; this.retryable = retryable; this.code = code; }
}

function createSteamClient({ apiKey, http = axios }) {
  if (!apiKey) throw new SteamProviderError('Steam sync is unavailable because STEAM_API_KEY is not configured', false, 'steam_not_configured');
  return {
    async listOwnedGames(steamId) {
      if (!/^\d{17}$/.test(String(steamId))) throw new SteamProviderError('Steam ID must be a 17-digit SteamID64');
      try {
        const response = await http.get('https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/', { params: { key: apiKey, steamid: steamId, include_appinfo: 1, include_played_free_games: 1 }, timeout: 10_000 });
        const games = response.data?.response?.games;
        if (!Array.isArray(games)) return [];
        return games.filter((game) => Number.isInteger(game.appid) && typeof game.name === 'string' && game.name.trim()).map((game) => ({ providerGameId: String(game.appid), providerTitle: game.name.trim() }));
      } catch (error) {
        if (error instanceof SteamProviderError) throw error;
        const status = error.response?.status;
        if (status === 401 || status === 403) {
          throw new SteamProviderError('Steam rejected this request. Check that STEAM_API_KEY is valid and that the Steam profile is public.', false, 'steam_access_denied');
        }
        if (status === 429) {
          throw new SteamProviderError('Steam rate-limited this sync. It will be retried automatically.', true, 'steam_rate_limited');
        }
        if (status >= 500) {
          throw new SteamProviderError('Steam is temporarily unavailable. The sync will be retried automatically.', true, 'steam_unavailable');
        }
        if (!error.response) {
          throw new SteamProviderError('Steam could not be reached. Check this server’s network connection; the sync will be retried automatically.', true, 'steam_network_error');
        }
        const retryable = !error.response || error.response.status >= 500 || error.response.status === 429;
        throw new SteamProviderError(`Steam library request failed with status ${status}`, retryable);
      }
    }
  };
}
module.exports = { createSteamClient, SteamProviderError };