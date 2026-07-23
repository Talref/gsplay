const { createIgdbClient, escapeApicalypse, IgdbProviderError } = require('../../src/v2/providers/igdbClient');

describe('v2 IGDB client', () => {
  test('escapes title input, caches OAuth, and only accepts one exact normalized result', async () => {
    const http = { post: jest.fn()
      .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
      .mockResolvedValueOnce({ data: [{ id: 9, name: 'Aqua "Quest"', genres: [{ name: 'Adventure' }], cover: { image_id: 'cover' } }] })
      .mockResolvedValueOnce({ data: [{ id: 10, name: 'Different Game' }] }) };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    expect(await client.findExactTitle('Aqua "Quest"')).toMatchObject({ igdbId: 9, genres: ['Adventure'], artwork: expect.stringContaining('/cover.jpg') });
    expect(await client.findExactTitle('Aqua "Quest"')).toBeNull();
    expect(http.post).toHaveBeenCalledTimes(3);
    expect(http.post.mock.calls[1][1]).toContain('search \"aqua quest\"');
    expect(escapeApicalypse('a\\b"c')).toBe('a\\\\b\\"c');
  });

  test('looks up a strict IGDB slug through the authenticated client', async () => {
    const http = { post: jest.fn()
      .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
      .mockResolvedValueOnce({ data: [{ id: 77, name: 'Vintage Story', url: 'https://www.igdb.com/games/vintage-story' }] }) };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.getGameBySlug('vintage-story')).resolves.toMatchObject({ igdbId: 77, canonicalTitle: 'Vintage Story' });
    await expect(client.getGameBySlug('../bad')).rejects.toThrow('slug is invalid');
  });

  test('marks provider rate limits retryable', async () => {
    const http = { post: jest.fn().mockResolvedValueOnce({ data: { access_token: 'token' } }).mockRejectedValueOnce({ response: { status: 429 } }) };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.findExactTitle('Aqua')).rejects.toEqual(expect.objectContaining({ name: 'IgdbProviderError', retryable: true }));
    expect(IgdbProviderError).toBeDefined();
  });

  test('returns valid candidate DTOs when a successful lookup has no exact match', async () => {
    const http = { post: jest.fn()
      .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
      .mockResolvedValueOnce({ data: [{ id: 44, name: 'Bad North', platforms: [{ name: 'PC' }] }, { id: 45, name: 'Bad North Deluxe Edition' }] }) };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.searchTitle('Bad North Jotunn Edition')).resolves.toMatchObject({ outcome: 'not_found', candidates: [{ igdbId: 44, title: 'Bad North', platforms: ['PC'] }, { igdbId: 45, title: 'Bad North Deluxe Edition' }] });
  });

  test('prefers the first desktop candidate among otherwise ambiguous exact title matches', async () => {
    const http = { post: jest.fn()
      .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
      .mockResolvedValueOnce({ data: [{ id: 1, name: 'Carcassonne', platforms: [{ name: 'Windows Phone' }] }, { id: 2, name: 'Carcassonne', platforms: [{ name: 'iOS' }] }, { id: 3, name: 'Carcassonne', platforms: [{ name: 'PC (Microsoft Windows)' }, { name: 'Nintendo Switch' }] }, { id: 4, name: 'Carcassonne', platforms: [{ name: 'Xbox 360' }] }] }) };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.searchTitle('Carcassonne')).resolves.toMatchObject({ outcome: 'matched', match: { igdbId: 3, canonicalTitle: 'Carcassonne', platforms: ['PC (Microsoft Windows)', 'Nintendo Switch'] } });
  });

  test('prefers a primary title over an edition that exposes the title as an alternative name', async () => {
    const http = { post: jest.fn()
      .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
      .mockResolvedValueOnce({ data: [{ id: 801, name: 'Control: Ultimate Edition', alternative_names: [{ name: 'Control' }], platforms: [{ name: 'PC (Microsoft Windows)' }] }, { id: 802, name: 'Control', platforms: [{ name: 'PC (Microsoft Windows)' }] }] }) };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.searchTitle('Control')).resolves.toMatchObject({ outcome: 'matched', match: { igdbId: 802, canonicalTitle: 'Control' } });
  });

  test('leaves multiple non-desktop exact matches unresolved', async () => {
    const http = { post: jest.fn()
      .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
      .mockResolvedValueOnce({ data: [{ id: 1, name: 'Carcassonne', platforms: [{ name: 'Windows Phone' }] }, { id: 2, name: 'Carcassonne', platforms: [{ name: 'iOS' }] }] }) };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.searchTitle('Carcassonne')).resolves.toMatchObject({ outcome: 'ambiguous', candidates: [{ igdbId: 1 }, { igdbId: 2 }] });
  });

  test('classifies OAuth credential rejection as a provider-wide authentication failure', async () => {
    const http = { post: jest.fn().mockRejectedValueOnce({ response: { status: 400 }, message: 'Invalid client' }) };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.findExactTitle('Aqua')).rejects.toEqual(expect.objectContaining({ authenticationFailed: true, retryable: false, status: 400 }));
  });

  test('matches titles that differ only by trademark-style marks', async () => {
    const http = { post: jest.fn()
      .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
      .mockResolvedValueOnce({ data: [{ id: 128334, name: 'Star Wars Battlefront II: Celebration Edition', platforms: [{ name: 'PC (Microsoft Windows)' }] }] }) };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.searchTitle('STAR WARS™ Battlefront™ II: Celebration Edition')).resolves.toMatchObject({ outcome: 'matched', match: { igdbId: 128334 } });
    expect(http.post.mock.calls[1][1]).toContain('search "star wars battlefront ii celebration edition"');
  });
});