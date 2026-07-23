const axios = require('axios');
const { normalizeTitle } = require('../services/titleNormalization');

class IgdbProviderError extends Error {
  constructor(message, retryable = false, status, code, authenticationFailed = false) { super(message); this.name = 'IgdbProviderError'; this.retryable = retryable; this.status = status; this.code = code; this.authenticationFailed = authenticationFailed; }
}

function providerError(error, { tokenRequest = false } = {}) {
  const status = error.response?.status;
  const authenticationFailed = status === 401 || status === 403 || (tokenRequest && status === 400);
  const retryable = !authenticationFailed && (!status || status === 429 || status >= 500);
  return new IgdbProviderError(error.message || 'IGDB request failed', retryable, status, error.code, authenticationFailed);
}

function escapeApicalypse(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeIgdbSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,254}$/.test(slug)) throw new IgdbProviderError('IGDB slug is invalid');
  return slug;
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

function candidateOf(game) {
  return { igdbId: game.igdbId, title: game.canonicalTitle, artwork: game.artwork, releaseDate: game.releaseDate, platforms: game.platforms, companies: game.companies, igdbUrl: game.igdbUrl };
}

function isDesktopGame(game) {
  return game.platforms.some((platform) => ['PC (Microsoft Windows)', 'Linux', 'Mac'].includes(platform));
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
    } catch (error) { throw providerError(error, { tokenRequest: true }); }
  }
  return {
    async searchTitle(title) {
      const normalized = normalizeTitle(title);
      const query = `search \"${escapeApicalypse(normalized)}\"; fields id,name,alternative_names.name,summary,genres.name,platforms.name,game_modes.name,rating,cover.image_id,first_release_date,videos.video_id,involved_companies.company.name,url; limit 10;`;
      try {
        const response = await http.post('https://api.igdb.com/v4/games', query, { headers: { 'Client-ID': clientId, Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'text/plain' } });
        const games = (response.data || []).map(mapGame);
        const primary = games.filter((game) => game.normalizedTitle === normalized);
        const alternatives = games.filter((game) => game.alternativeTitles.some((alternative) => normalizeTitle(alternative) === normalized));
        const candidates = primary.length ? primary : alternatives;
        const desktop = candidates.filter(isDesktopGame);
        if (candidates.length === 1) return { outcome: 'matched', match: candidates[0], candidates: candidates.map(candidateOf) };
        if (desktop.length === 1) return { outcome: 'matched', match: desktop[0], candidates: candidates.map(candidateOf) };
        return { outcome: candidates.length ? 'ambiguous' : 'not_found', candidates: (candidates.length ? candidates : games).map(candidateOf).slice(0, 10) };
      } catch (error) {
        if (error instanceof IgdbProviderError) throw error;
        throw providerError(error);
      }
    },
    async findExactTitle(title) {
      const result = await this.searchTitle(title);
      return result.outcome === 'matched' ? result.match : null;
    },
    async getGameById(igdbId) {
      if (!Number.isInteger(Number(igdbId)) || Number(igdbId) < 1) throw new IgdbProviderError('IGDB game ID must be positive');
      const query = `where id = ${Number(igdbId)}; fields id,name,alternative_names.name,summary,genres.name,platforms.name,game_modes.name,rating,cover.image_id,first_release_date,videos.video_id,involved_companies.company.name,url; limit 1;`;
      try {
        const response = await http.post('https://api.igdb.com/v4/games', query, { headers: { 'Client-ID': clientId, Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'text/plain' } });
        const game = response.data?.[0];
        return game ? mapGame(game) : null;
      } catch (error) {
        if (error instanceof IgdbProviderError) throw error;
        throw providerError(error);
      }
    }
    ,
    async getGameBySlug(slug) {
      const safeSlug = escapeIgdbSlug(slug);
      const query = `where slug = "${safeSlug}"; fields id,name,alternative_names.name,summary,genres.name,platforms.name,game_modes.name,rating,cover.image_id,first_release_date,videos.video_id,involved_companies.company.name,url; limit 1;`;
      try {
        const response = await http.post('https://api.igdb.com/v4/games', query, { headers: { 'Client-ID': clientId, Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'text/plain' } });
        return response.data?.[0] ? mapGame(response.data[0]) : null;
      } catch (error) {
        if (error instanceof IgdbProviderError) throw error;
        throw providerError(error);
      }
    }
  };
}

module.exports = { createIgdbClient, escapeApicalypse, escapeIgdbSlug, IgdbProviderError };