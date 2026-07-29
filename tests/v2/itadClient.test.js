const { createItadClient, ItadProviderError } = require('../../src/v2/providers/itadClient');

describe('ITAD client', () => {
  test('uses the current search API and accepts only an exact normalized game title', async () => {
    const http = { get: jest.fn().mockResolvedValue({ data: [
      { id: 'nearby', title: 'Party Animals 2', type: 'game' },
      { id: 'party-animals', title: 'Party Animals', type: 'game' },
      { id: 'bundle', title: 'Party Animals', type: 'bundle' }
    ] }) };
    await expect(createItadClient({ apiKey: 'secret', http }).lookupTitle('Party Animals')).resolves.toEqual({ outcome: 'matched', game: { id: 'party-animals', title: 'Party Animals' } });
    expect(http.get).toHaveBeenCalledWith('/games/search/v1', { params: { key: 'secret', title: 'Party Animals', results: 20 } });
  });

  test('rejects fuzzy-only results and reports duplicate exact identities as ambiguous', async () => {
    const http = { get: jest.fn()
      .mockResolvedValueOnce({ data: [{ id: 'sequel', title: 'Party Animals 2', type: 'game' }] })
      .mockResolvedValueOnce({ data: [{ id: 'one', title: 'Party Animals', type: 'game' }, { id: 'two', title: 'Party Animals', type: 'game' }] }) };
    const client = createItadClient({ apiKey: 'secret', http });
    await expect(client.lookupTitle('Party Animals')).resolves.toEqual({ outcome: 'not_found' });
    await expect(client.lookupTitle('Party Animals')).resolves.toEqual({ outcome: 'ambiguous' });
  });

  test('classifies upstream failures without exposing the API key', async () => {
    const http = { get: jest.fn().mockRejectedValue(Object.assign(new Error('Request failed'), { response: { status: 503 } })) };
    await expect(createItadClient({ apiKey: 'secret', http }).lookupTitle('Party Animals')).rejects.toMatchObject({ name: 'ItadProviderError', status: 503, retryable: true });
    await expect(createItadClient({ http }).lookupTitle('Party Animals')).rejects.toBeInstanceOf(ItadProviderError);
  });

  test('returns the cheapest direct deal URL with regular price and discount metadata', async () => {
    const http = { post: jest.fn().mockResolvedValue({ data: [{ deals: [
      { shop: { name: 'Expensive Shop' }, url: 'https://isthereanydeal.com/game/party/deal-one', price: { amount: 19.99, currency: 'EUR' }, regular: { amount: 29.99, currency: 'EUR' }, cut: 33 },
      { shop: { name: 'Best Shop' }, url: 'https://isthereanydeal.com/game/party/deal-two', price: { amount: 7.49, currency: 'EUR' }, regular: { amount: 24.99, currency: 'EUR' }, cut: 70 }
    ] }] }) };
    await expect(createItadClient({ apiKey: 'secret', http }).bestOffer('party')).resolves.toMatchObject({ shop: 'Best Shop', url: 'https://isthereanydeal.com/game/party/deal-two', price: 7.49, currency: 'EUR', regularPrice: 24.99, discountPercent: 70 });
    expect(http.post).toHaveBeenCalledWith('/games/prices/v3', ['party'], { params: { key: 'secret' } });
  });
});