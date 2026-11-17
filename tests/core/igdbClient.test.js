const {
  createIgdbClient,
  escapeApicalypse,
  IgdbProviderError
} = require('../../src/core/providers/igdbClient');

describe('IGDB client', () => {
  test('resolves a nomination form in one IGDB request and rejects unsafe IDs', async () => {
    const http = {
      post: jest
        .fn()
        .mockResolvedValueOnce({ data: { access_token: 'token' } })
        .mockResolvedValueOnce({
          data: [
            { id: 1, name: 'First' },
            { id: 2, name: 'Second' }
          ]
        })
    };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    expect((await client.getGamesByIds([1, 2])).map((game) => game.igdbId)).toEqual([1, 2]);
    expect(http.post).toHaveBeenCalledTimes(2);
    expect(http.post.mock.calls[1][1]).toContain('where id = (1,2)');
    await expect(client.getGamesByIds(['1); drop'])).rejects.toThrow('positive integers');
    expect(await client.getGamesByIds([])).toEqual([]);
    expect(http.post).toHaveBeenCalledTimes(2);
  });
  test('resolves canonical shortlist slugs together and maps them without choosing finalists', async () => {
    const http = {
      post: jest
        .fn()
        .mockResolvedValueOnce({ data: { access_token: 'token' } })
        .mockResolvedValueOnce({
          data: [
            { id: 1, name: 'First', slug: 'first' },
            { id: 2, name: 'Second', slug: 'second' }
          ]
        })
    };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    const games = await client.getGamesBySlugs(['first', 'second']);
    expect(games.get('second').igdbId).toBe(2);
    expect(http.post).toHaveBeenCalledTimes(2);
    expect(http.post.mock.calls[1][1]).toContain('where slug = ("first","second")');
    await expect(client.getGamesBySlugs(['../bad'])).rejects.toThrow('slug is invalid');
  });
  test('Awards search preserves all platforms and partial title matches', async () => {
    const http = {
      post: jest
        .fn()
        .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
        .mockResolvedValueOnce({
          data: [
            { id: 1, name: 'Quest', platforms: [{ name: 'PC (Microsoft Windows)' }] },
            { id: 2, name: 'Quest for Glory', platforms: [{ name: 'Nintendo Switch' }] },
            { id: 3, name: 'Another Quest', platforms: [{ name: 'iOS' }] }
          ]
        })
    };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    expect((await client.searchGames('Quest')).map((game) => game.igdbId)).toEqual([1, 2, 3]);
    expect(http.post.mock.calls[1][1]).not.toContain('where');
  });
  test('escapes title input, caches OAuth, and accepts one desktop exact result', async () => {
    const http = {
      post: jest
        .fn()
        .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
        .mockResolvedValueOnce({
          data: [
            {
              id: 9,
              name: 'Aqua "Quest"',
              genres: [{ name: 'Adventure' }],
              platforms: [{ name: 'PC (Microsoft Windows)' }],
              cover: { image_id: 'cover' }
            }
          ]
        })
        .mockResolvedValueOnce({ data: [{ id: 10, name: 'Different Game' }] })
    };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    expect(await client.findExactTitle('Aqua "Quest"')).toMatchObject({
      igdbId: 9,
      genres: ['Adventure'],
      artwork: expect.stringContaining('/cover.jpg')
    });
    expect(await client.findExactTitle('Aqua "Quest"')).toBeNull();
    expect(http.post).toHaveBeenCalledTimes(3);
    expect(http.post.mock.calls[1][1]).toContain('search "aqua quest"');
    expect(escapeApicalypse('a\\b"c')).toBe('a\\\\b\\"c');
  });

  test('looks up a strict IGDB slug through the authenticated client', async () => {
    const http = {
      post: jest
        .fn()
        .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
        .mockResolvedValueOnce({
          data: [{ id: 77, name: 'Vintage Story', url: 'https://www.igdb.com/games/vintage-story' }]
        })
    };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.getGameBySlug('vintage-story')).resolves.toMatchObject({
      igdbId: 77,
      canonicalTitle: 'Vintage Story'
    });
    await expect(client.getGameBySlug('../bad')).rejects.toThrow('slug is invalid');
  });

  test('marks provider rate limits retryable', async () => {
    const http = {
      post: jest
        .fn()
        .mockResolvedValueOnce({ data: { access_token: 'token' } })
        .mockRejectedValueOnce({ response: { status: 429 } })
    };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.findExactTitle('Aqua')).rejects.toEqual(
      expect.objectContaining({ name: 'IgdbProviderError', retryable: true })
    );
    expect(IgdbProviderError).toBeDefined();
  });

  test('returns valid candidate DTOs when a successful lookup has no exact match', async () => {
    const http = {
      post: jest
        .fn()
        .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
        .mockResolvedValueOnce({
          data: [
            { id: 44, name: 'Bad North', platforms: [{ name: 'PC' }] },
            { id: 45, name: 'Bad North Deluxe Edition' }
          ]
        })
    };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.searchTitle('Bad North Jotunn Edition')).resolves.toMatchObject({
      outcome: 'not_found',
      candidates: [
        { igdbId: 44, title: 'Bad North', platforms: ['PC'] },
        { igdbId: 45, title: 'Bad North Deluxe Edition' }
      ]
    });
  });

  test('prefers the first desktop candidate among otherwise ambiguous exact title matches', async () => {
    const http = {
      post: jest
        .fn()
        .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
        .mockResolvedValueOnce({
          data: [
            { id: 1, name: 'Carcassonne', platforms: [{ name: 'Windows Phone' }] },
            { id: 2, name: 'Carcassonne', platforms: [{ name: 'iOS' }] },
            {
              id: 3,
              name: 'Carcassonne',
              platforms: [{ name: 'PC (Microsoft Windows)' }, { name: 'Nintendo Switch' }]
            },
            { id: 4, name: 'Carcassonne', platforms: [{ name: 'Xbox 360' }] }
          ]
        })
    };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.searchTitle('Carcassonne')).resolves.toMatchObject({
      outcome: 'matched',
      match: {
        igdbId: 3,
        canonicalTitle: 'Carcassonne',
        platforms: ['PC (Microsoft Windows)', 'Nintendo Switch']
      }
    });
  });

  test('leaves a sole non-desktop exact match unresolved', async () => {
    const http = {
      post: jest
        .fn()
        .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
        .mockResolvedValueOnce({
          data: [
            {
              id: 91,
              name: 'We Were Here Together',
              platforms: [{ name: 'Nintendo Switch' }]
            }
          ]
        })
    };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.searchTitle('We Were Here Together')).resolves.toMatchObject({
      outcome: 'ambiguous',
      candidates: [{ igdbId: 91, platforms: ['Nintendo Switch'] }]
    });
  });

  test('prefers a primary title over an edition that exposes the title as an alternative name', async () => {
    const http = {
      post: jest
        .fn()
        .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
        .mockResolvedValueOnce({
          data: [
            {
              id: 801,
              name: 'Control: Ultimate Edition',
              alternative_names: [{ name: 'Control' }],
              platforms: [{ name: 'PC (Microsoft Windows)' }]
            },
            { id: 802, name: 'Control', platforms: [{ name: 'PC (Microsoft Windows)' }] }
          ]
        })
    };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.searchTitle('Control')).resolves.toMatchObject({
      outcome: 'matched',
      match: { igdbId: 802, canonicalTitle: 'Control' }
    });
  });

  test('leaves multiple non-desktop exact matches unresolved', async () => {
    const http = {
      post: jest
        .fn()
        .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
        .mockResolvedValueOnce({
          data: [
            { id: 1, name: 'Carcassonne', platforms: [{ name: 'Windows Phone' }] },
            { id: 2, name: 'Carcassonne', platforms: [{ name: 'iOS' }] }
          ]
        })
    };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.searchTitle('Carcassonne')).resolves.toMatchObject({
      outcome: 'ambiguous',
      candidates: [{ igdbId: 1 }, { igdbId: 2 }]
    });
  });

  test('classifies OAuth credential rejection as a provider-wide authentication failure', async () => {
    const http = {
      post: jest
        .fn()
        .mockRejectedValueOnce({ response: { status: 400 }, message: 'Invalid client' })
    };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.findExactTitle('Aqua')).rejects.toEqual(
      expect.objectContaining({ authenticationFailed: true, retryable: false, status: 400 })
    );
  });

  test('retries one transient OAuth timeout and shares that token request across concurrent lookups', async () => {
    const timeout = Object.assign(new Error('timeout of 10000ms exceeded'), {
      code: 'ECONNABORTED'
    });
    const http = {
      post: jest
        .fn()
        .mockRejectedValueOnce(timeout)
        .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
        .mockResolvedValue({ data: [] })
    };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(
      Promise.all([client.getGameBySlug('first-game'), client.getGameBySlug('second-game')])
    ).resolves.toEqual([null, null]);
    expect(http.post).toHaveBeenCalledTimes(4);
    expect(http.post.mock.calls.filter(([url]) => url.includes('oauth2/token'))).toHaveLength(2);
  });

  test('retains safe retryable OAuth timeout context after the bounded retry is exhausted', async () => {
    const timeout = Object.assign(new Error('timeout of 10000ms exceeded'), {
      code: 'ECONNABORTED'
    });
    const http = { post: jest.fn().mockRejectedValue(timeout) };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.getGameBySlug('vintage-story')).rejects.toEqual(
      expect.objectContaining({
        provider: 'igdb',
        operation: 'oauth_token',
        retryable: true,
        code: 'ECONNABORTED'
      })
    );
    expect(http.post).toHaveBeenCalledTimes(2);
  });

  test('matches titles that differ only by trademark-style marks', async () => {
    const http = {
      post: jest
        .fn()
        .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
        .mockResolvedValueOnce({
          data: [
            {
              id: 128334,
              name: 'Star Wars Battlefront II: Celebration Edition',
              platforms: [{ name: 'PC (Microsoft Windows)' }]
            }
          ]
        })
    };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(
      client.searchTitle('STAR WARS™ Battlefront™ II: Celebration Edition')
    ).resolves.toMatchObject({ outcome: 'matched', match: { igdbId: 128334 } });
    expect(http.post.mock.calls[1][1]).toContain(
      'search "star wars battlefront ii celebration edition"'
    );
  });
});
