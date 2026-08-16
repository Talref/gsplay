const axios = require('axios');

class SteamProviderError extends Error {
  constructor(message, retryable = false, code = 'steam_request_failed') {
    super(message);
    this.name = 'SteamProviderError';
    this.retryable = retryable;
    this.code = code;
  }
}

function createSteamClient({ apiKey, http = axios }) {
  const validateSteamId = (steamId) => {
    if (!/^\d{17}$/.test(String(steamId)))
      throw new SteamProviderError('Steam ID must be a 17-digit SteamID64');
  };
  const providerFailure = (error, operation) => {
    if (error instanceof SteamProviderError) return error;
    const status = error.response?.status;
    if (status === 401 || status === 403)
      return new SteamProviderError(
        `Steam denied access to this ${operation}.`,
        false,
        'steam_access_denied'
      );
    if (status === 429)
      return new SteamProviderError(
        'Steam rate-limited this request. It will be retried automatically.',
        true,
        'steam_rate_limited'
      );
    if (status >= 500)
      return new SteamProviderError(
        'Steam is temporarily unavailable. The request will be retried automatically.',
        true,
        'steam_unavailable'
      );
    if (!error.response)
      return new SteamProviderError(
        'Steam could not be reached. Check this server’s network connection.',
        true,
        'steam_network_error'
      );
    return new SteamProviderError(
      `Steam ${operation} request failed with status ${status}`,
      false
    );
  };
  return {
    async listOwnedGames(steamId) {
      validateSteamId(steamId);
      if (!apiKey)
        throw new SteamProviderError(
          'Steam sync is unavailable because STEAM_API_KEY is not configured',
          false,
          'steam_not_configured'
        );
      try {
        const response = await http.get(
          'https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/',
          {
            params: {
              key: apiKey,
              steamid: steamId,
              include_appinfo: 1,
              include_played_free_games: 1
            },
            timeout: 10_000
          }
        );
        const games = response.data?.response?.games;
        if (!Array.isArray(games)) return [];
        return games
          .filter(
            (game) =>
              Number.isInteger(game.appid) && typeof game.name === 'string' && game.name.trim()
          )
          .map((game) => ({ providerGameId: String(game.appid), providerTitle: game.name.trim() }));
      } catch (error) {
        throw providerFailure(error, 'library');
      }
    },
    async listWishlist(steamId) {
      validateSteamId(steamId);
      try {
        const response = await http.get(
          'https://api.steampowered.com/IWishlistService/GetWishlist/v1/',
          { params: { steamid: steamId }, timeout: 10_000 }
        );
        const items = response.data?.response?.items;
        if (!Array.isArray(items))
          throw new SteamProviderError(
            'Steam wishlist is private, unavailable, or returned an unsupported response.',
            false,
            'steam_wishlist_unavailable'
          );
        if (
          items.some(
            (item) =>
              !item || !Number.isInteger(item.appid) || item.appid <= 0
          )
        )
          throw new SteamProviderError(
            'Steam returned an unsupported wishlist response.',
            false,
            'steam_wishlist_invalid_response'
          );
        return [...new Set(items.map((item) => String(item.appid)))];
      } catch (error) {
        throw providerFailure(error, 'wishlist');
      }
    }
  };
}
module.exports = { createSteamClient, SteamProviderError };
