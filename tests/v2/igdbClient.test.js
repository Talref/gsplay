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
    expect(http.post.mock.calls[1][1]).toContain('Aqua \\"Quest\\"');
    expect(escapeApicalypse('a\\b"c')).toBe('a\\\\b\\"c');
  });

  test('marks provider rate limits retryable', async () => {
    const http = { post: jest.fn().mockResolvedValueOnce({ data: { access_token: 'token' } }).mockRejectedValueOnce({ response: { status: 429 } }) };
    const client = createIgdbClient({ clientId: 'client', clientSecret: 'secret', http });
    await expect(client.findExactTitle('Aqua')).rejects.toEqual(expect.objectContaining({ name: 'IgdbProviderError', retryable: true }));
    expect(IgdbProviderError).toBeDefined();
  });
});