const axios = require('axios');
const { normalizeTitle } = require('../services/titleNormalization');

const EDITION_SUFFIX = /\s+(?:complete|deluxe|definitive|ultimate|standard|special|enhanced|anniversary|game of the year|goty)\s+edition$/;

class ItadProviderError extends Error {
  constructor(message, { retryable = false, status, code } = {}) { super(message); this.name = 'ItadProviderError'; this.provider = 'itad'; this.retryable = retryable; this.status = status; this.code = code; }
}

function providerError(error) {
  const status = error.response?.status;
  return new ItadProviderError(error.message || 'ITAD request failed', { status, code: error.code, retryable: !status || status === 429 || status >= 500 });
}

function cheapestOffer(item) {
  const deals = Array.isArray(item?.deals) ? item.deals : [];
  const steamPreference = (deal) => /^steam$/i.test(deal?.shop?.name || '') ? 0 : 1;
  const deal = deals.filter((candidate) => candidate?.shop?.name && candidate?.url)
    .sort((a, b) => {
      const priceDifference = (a.price?.amount ?? Infinity) - (b.price?.amount ?? Infinity);
      return priceDifference || steamPreference(a) - steamPreference(b);
    })[0];
  return deal ? {
    shop: deal.shop.name,
    url: deal.url,
    price: deal.price?.amount,
    currency: deal.price?.currency,
    regularPrice: deal.regular?.amount,
    discountPercent: Number.isFinite(deal.cut) ? deal.cut : undefined,
    retrievedAt: new Date()
  } : null;
}

function createItadClient({ apiKey, http = axios.create({ baseURL: 'https://api.isthereanydeal.com', timeout: 10_000 }) }) {
  function configured() { if (!apiKey) throw new ItadProviderError('ITAD API key is not configured'); }
  return {
    async lookupTitle(title) {
      configured();
      try {
        const { data } = await http.get('/games/search/v1', { params: { key: apiKey, title, results: 20 } });
        const normalized = normalizeTitle(title);
        const games = (Array.isArray(data) ? data : []).filter((game) => game?.type === 'game' && game?.id && game?.title);
        const exact = games.filter((game) => normalizeTitle(game.title) === normalized);
        const candidates = exact.length ? exact : games.filter((game) => normalizeTitle(game.title).replace(EDITION_SUFFIX, '') === normalized);
        if (!candidates.length) return { outcome: 'not_found' };
        if (new Set(candidates.map((game) => String(game.id))).size > 1) return { outcome: 'ambiguous' };
        return { outcome: 'matched', game: { id: String(candidates[0].id), title: String(candidates[0].title) } };
      } catch (error) { if (error instanceof ItadProviderError) throw error; throw providerError(error); }
    },
    async bestOffers(gameIds) {
      configured();
      if (!Array.isArray(gameIds) || gameIds.length < 1 || gameIds.length > 200 || new Set(gameIds).size !== gameIds.length) {
        throw new ItadProviderError('ITAD price lookup requires 1 to 200 unique game IDs');
      }
      try {
        const { data } = await http.post('/games/prices/v3', gameIds, { params: { key: apiKey } });
        const rows = Array.isArray(data) ? data : [];
        const byId = new Map(rows.filter((row) => row?.id).map((row) => [String(row.id), row]));
        return new Map(gameIds.map((gameId, index) => [
          gameId,
          cheapestOffer(byId.get(String(gameId)) || (rows.length === gameIds.length ? rows[index] : undefined))
        ]));
      } catch (error) { if (error instanceof ItadProviderError) throw error; throw providerError(error); }
    },
    async bestOffer(gameId) {
      return (await this.bestOffers([gameId])).get(gameId) || null;
    }
  };
}
module.exports = { createItadClient, ItadProviderError };
