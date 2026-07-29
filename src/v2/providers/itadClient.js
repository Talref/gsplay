const axios = require('axios');

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
        // ITAD Service Lookup v1 returns stable ITAD game identities. We only
        // accept an explicit found game; title fallback is deliberately never OK.
        const { data } = await http.post('/service/lookup/v1', [{ title, type: 'game' }], { params: { key: apiKey } });
        const row = Array.isArray(data) ? data[0] : data?.[0]; const game = row?.game || row?.found?.game;
        if (!game?.id || !game?.title) return { outcome: 'not_found' };
        return { outcome: 'matched', game: { id: String(game.id), title: String(game.title) } };
      } catch (error) { if (error instanceof ItadProviderError) throw error; throw providerError(error); }
    },
    async bestOffer(gameId) {
      configured();
      try {
        const { data } = await http.post('/games/prices/v3', [gameId], { params: { key: apiKey } });
        const prices = Array.isArray(data) ? data[0]?.deals || [] : [];
        const deal = prices.filter((item) => item?.shop?.name && item?.url).sort((a, b) => (a.price?.amount ?? Infinity) - (b.price?.amount ?? Infinity))[0];
        return deal ? { shop: deal.shop.name, url: deal.url, price: deal.price?.amount, currency: deal.price?.currency, retrievedAt: new Date() } : null;
      } catch (error) { if (error instanceof ItadProviderError) throw error; throw providerError(error); }
    }
  };
}
module.exports = { createItadClient, ItadProviderError };