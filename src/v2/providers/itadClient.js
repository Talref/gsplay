const axios = require('axios');
const { normalizeTitle } = require('../services/titleNormalization');

class ItadProviderError extends Error {
  constructor(message, { retryable = false, status, code } = {}) { super(message); this.name = 'ItadProviderError'; this.provider = 'itad'; this.retryable = retryable; this.status = status; this.code = code; }
}

function providerError(error) {
  const status = error.response?.status;
  return new ItadProviderError(error.message || 'ITAD request failed', { status, code: error.code, retryable: !status || status === 429 || status >= 500 });
}

function createItadClient({ apiKey, http = axios.create({ baseURL: 'https://api.isthereanydeal.com', timeout: 10_000 }) }) {
  function configured() { if (!apiKey) throw new ItadProviderError('ITAD API key is not configured'); }
  return {
    async lookupTitle(title) {
      configured();
      try {
        const { data } = await http.get('/games/search/v1', { params: { key: apiKey, title, results: 20 } });
        const normalized = normalizeTitle(title);
        const exact = (Array.isArray(data) ? data : []).filter((game) => game?.type === 'game' && game?.id && game?.title && normalizeTitle(game.title) === normalized);
        if (!exact.length) return { outcome: 'not_found' };
        if (new Set(exact.map((game) => String(game.id))).size > 1) return { outcome: 'ambiguous' };
        return { outcome: 'matched', game: { id: String(exact[0].id), title: String(exact[0].title) } };
      } catch (error) { if (error instanceof ItadProviderError) throw error; throw providerError(error); }
    },
    async bestOffer(gameId) {
      configured();
      try {
        const { data } = await http.post('/games/prices/v3', [gameId], { params: { key: apiKey } });
        const prices = Array.isArray(data) ? data[0]?.deals || [] : [];
        const deal = prices.filter((item) => item?.shop?.name && item?.url).sort((a, b) => (a.price?.amount ?? Infinity) - (b.price?.amount ?? Infinity))[0];
        return deal ? {
          shop: deal.shop.name,
          url: deal.url,
          price: deal.price?.amount,
          currency: deal.price?.currency,
          regularPrice: deal.regular?.amount,
          discountPercent: Number.isFinite(deal.cut) ? deal.cut : undefined,
          retrievedAt: new Date()
        } : null;
      } catch (error) { if (error instanceof ItadProviderError) throw error; throw providerError(error); }
    }
  };
}
module.exports = { createItadClient, ItadProviderError };