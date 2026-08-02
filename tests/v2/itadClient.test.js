const { createItadClient, ItadProviderError } = require('../../src/v2/providers/itadClient');

describe('ITAD client', () => {
  test('uses the current search API and accepts only an exact normalized game title', async () => {
    const http = {
      get: jest.fn().mockResolvedValue({
        data: [
          { id: 'nearby', title: 'Party Animals 2', type: 'game' },
          { id: 'party-animals', title: 'Party Animals', type: 'game' },
          { id: 'bundle', title: 'Party Animals', type: 'bundle' }
        ]
      })
    };
    await expect(
      createItadClient({ apiKey: 'secret', http }).lookupTitle('Party Animals')
    ).resolves.toEqual({
      outcome: 'matched',
      game: { id: 'party-animals', title: 'Party Animals' }
    });
    expect(http.get).toHaveBeenCalledWith('/games/search/v1', {
      params: { key: 'secret', title: 'Party Animals', results: 20 }
    });
  });

  test('rejects fuzzy-only results and reports duplicate exact identities as ambiguous', async () => {
    const http = {
      get: jest
        .fn()
        .mockResolvedValueOnce({ data: [{ id: 'sequel', title: 'Party Animals 2', type: 'game' }] })
        .mockResolvedValueOnce({
          data: [
            { id: 'one', title: 'Party Animals', type: 'game' },
            { id: 'two', title: 'Party Animals', type: 'game' }
          ]
        })
    };
    const client = createItadClient({ apiKey: 'secret', http });
    await expect(client.lookupTitle('Party Animals')).resolves.toEqual({ outcome: 'not_found' });
    await expect(client.lookupTitle('Party Animals')).resolves.toEqual({ outcome: 'ambiguous' });
  });

  test('accepts one recognized edition of a base title without matching unrelated products', async () => {
    const http = {
      get: jest.fn().mockResolvedValue({
        data: [
          { id: 'complete', title: 'You Suck at Parking Complete Edition', type: 'game' },
          { id: 'soundtrack', title: 'You Suck at Parking Soundtrack', type: null },
          { id: 'pack', title: 'You Suck at Parking - 4 Pack', type: null }
        ]
      })
    };
    await expect(
      createItadClient({ apiKey: 'secret', http }).lookupTitle('You Suck at Parking')
    ).resolves.toEqual({
      outcome: 'matched',
      game: { id: 'complete', title: 'You Suck at Parking Complete Edition' }
    });
  });

  test('classifies upstream failures without exposing the API key', async () => {
    const http = {
      get: jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('Request failed'), { response: { status: 503 } })
        )
    };
    await expect(
      createItadClient({ apiKey: 'secret', http }).lookupTitle('Party Animals')
    ).rejects.toMatchObject({ name: 'ItadProviderError', status: 503, retryable: true });
    await expect(createItadClient({ http }).lookupTitle('Party Animals')).rejects.toBeInstanceOf(
      ItadProviderError
    );
  });

  test('returns the cheapest direct deal URL with regular price and discount metadata', async () => {
    const http = {
      post: jest.fn().mockResolvedValue({
        data: [
          {
            deals: [
              {
                shop: { name: 'Expensive Shop' },
                url: 'https://isthereanydeal.com/game/party/deal-one',
                price: { amount: 19.99, currency: 'EUR' },
                regular: { amount: 29.99, currency: 'EUR' },
                cut: 33
              },
              {
                shop: { name: 'Best Shop' },
                url: 'https://isthereanydeal.com/game/party/deal-two',
                price: { amount: 7.49, currency: 'EUR' },
                regular: { amount: 24.99, currency: 'EUR' },
                cut: 70,
                voucher: 'PARTY10'
              }
            ]
          }
        ]
      })
    };
    await expect(
      createItadClient({ apiKey: 'secret', http }).bestOffer('party')
    ).resolves.toMatchObject({
      shop: 'Best Shop',
      url: 'https://isthereanydeal.com/game/party/deal-two',
      price: 7.49,
      currency: 'EUR',
      regularPrice: 24.99,
      discountPercent: 70,
      voucher: 'PARTY10'
    });
    expect(http.post).toHaveBeenCalledWith('/games/prices/v3', ['party'], {
      params: { key: 'secret', country: 'IT', vouchers: true }
    });
  });

  test('prefers Steam only when another store has the same lowest price', async () => {
    const equalHttp = {
      post: jest.fn().mockResolvedValue({
        data: [
          {
            deals: [
              {
                shop: { name: 'Xbox Store' },
                url: 'https://itad.link/xbox',
                price: { amount: 7.49, currency: 'EUR' }
              },
              {
                shop: { name: 'Steam' },
                url: 'https://itad.link/steam',
                price: { amount: 7.49, currency: 'EUR' }
              }
            ]
          }
        ]
      })
    };
    await expect(
      createItadClient({ apiKey: 'secret', http: equalHttp }).bestOffer('party')
    ).resolves.toMatchObject({ shop: 'Steam', url: 'https://itad.link/steam' });

    const cheaperHttp = {
      post: jest.fn().mockResolvedValue({
        data: [
          {
            deals: [
              {
                shop: { name: 'Steam' },
                url: 'https://itad.link/steam',
                price: { amount: 7.49, currency: 'EUR' }
              },
              {
                shop: { name: 'Xbox Store' },
                url: 'https://itad.link/xbox',
                price: { amount: 7.48, currency: 'EUR' }
              }
            ]
          }
        ]
      })
    };
    await expect(
      createItadClient({ apiKey: 'secret', http: cheaperHttp }).bestOffer('party')
    ).resolves.toMatchObject({ shop: 'Xbox Store', url: 'https://itad.link/xbox' });
  });

  test('loads and correlates best offers for a batch of game IDs in one request', async () => {
    const http = {
      post: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'second',
            deals: [
              {
                shop: { name: 'Shop B' },
                url: 'https://itad.link/second',
                price: { amount: 4.99, currency: 'EUR' }
              }
            ]
          },
          {
            id: 'first',
            deals: [
              {
                shop: { name: 'Shop A' },
                url: 'https://itad.link/first',
                price: { amount: 8.99, currency: 'EUR' }
              }
            ]
          }
        ]
      })
    };
    const offers = await createItadClient({ apiKey: 'secret', http }).bestOffers([
      'first',
      'second'
    ]);
    expect(offers.get('first')).toMatchObject({ shop: 'Shop A', price: 8.99 });
    expect(offers.get('second')).toMatchObject({ shop: 'Shop B', price: 4.99 });
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.post).toHaveBeenCalledWith('/games/prices/v3', ['first', 'second'], {
      params: { key: 'secret', country: 'IT', vouchers: true }
    });
  });
});
