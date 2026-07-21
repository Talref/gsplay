const axios = require('axios');
const { normalizeTitle } = require('../services/titleNormalization');

class IgdbProviderError extends Error {
  constructor(message, retryable = false) { super(message); this.name = 'IgdbProviderError'; this.retryable = retryable; }
}

function escapeApicalypse(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function coverUrl(imageId) {
  return imageId ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg` : null;
}

function mapGame(game) {
  return {
    igdbId: game.id,
    canonicalTitle: game.name,
    normalizedTitle: normalizeTitle(game.name),
    alternativeTitles: (game.alternative_names || []).map((item) => item.name).filter(Boolean).slice(0, 50),
    summary: game.summary || undefined,
    genres: (game.genres || []).map((item) => item.name).filter(Boolean),
    platforms: (game.platforms || []).map((item) => item.name).filter(Boolean),
    gameModes: (game.game_modes || []).map((item) => item.name).filter(Boolean),
    rating: Number.isFinite(game.rating) ? game.rating : undefined,
    artwork: coverUrl(game.cover?.image_id),
    releaseDate: Number.isInteger(game.first_release_date) ? new Date(game.first_release_date * 1000) : undefined,
    videos: (game.videos || []).map((item) => item.video_id).filter(Boolean).slice(0, 20),
    companies: (game.involved_companies || []).map((item) => item.company?.name).filter(Boolean).slice(0, 50),
    igdbUrl: game.url || undefined
  };
}

function createIgdbClient({ clientId, clientSecret, http = axios.create({ timeout: 10_000 }) }) {
  let token; let tokenExpiresAt = 0;
  async function accessToken() {
    if (token && Date.now() < tokenExpiresAt) return token;
    if (!clientId || !clientSecret) throw new IgdbProviderError('IGDB service credentials are not configured');
    try {
      const response = await http.post('https://id.twitch.tv/oauth2/token', null, { params: { client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' } });
      if (!response.data?.access_token) throw new Error('No access token returned');
      token = response.data.access_token; tokenExpiresAt = Date.now() + Math.max(60, Number(response.data.expires_in || 3600) - 60) * 1000;
      return token;
    } catch (error) { throw new IgdbProviderError('IGDB authentication request failed', error.response?.status >= 500 || !error.response); }
  }
  return {
    async findExactTitle(title) {
      const query = `search "${escapeApicalypse(title)}"; fields id,name,alternative_names.name,summary,genres.name,platforms.name,game_modes.name,rating,cover.image_id,first_release_date,videos.video_id,involved_companies.company.name,url; limit 10;`;
      try {
        const response = await http.post('https://api.igdb.com/v4/games', query, { headers: { 'Client-ID': clientId, Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'text/plain' } });
        const normalized = normalizeTitle(title);
        const exact = (response.data || []).map(mapGame).filter((game) => game.normalizedTitle === normalized);
        return exact.length === 1 ? exact[0] : null;
      } catch (error) {
        if (error instanceof IgdbProviderError) throw error;
        const status = error.response?.status;
        throw new IgdbProviderError('IGDB game lookup failed', status === 429 || status >= 500 || !status);
      }
    }
  };
}

module.exports = { createIgdbClient, escapeApicalypse, IgdbProviderError };