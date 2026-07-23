const { createSteamClient, SteamProviderError } = require('../../src/v2/providers/steamClient');

describe('v2 Steam provider client', () => {
  test('maps only well-formed owned-game results without leaking the API key into URLs', async () => {
    const get = jest.fn().mockResolvedValue({ data: { response: { games: [{ appid: 10, name: 'Aqua Quest' }, { appid: 'bad', name: 'Ignore' }, { appid: 11, name: '  ' }] } } });
    const games = await createSteamClient({ apiKey: 'test-key', http: { get } }).listOwnedGames('76561198000000000');
    expect(games).toEqual([{ providerGameId: '10', providerTitle: 'Aqua Quest' }]);
    expect(get.mock.calls[0][0]).toBe('https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/');
    expect(get.mock.calls[0][1].params.key).toBe('test-key');
  });
  test('rejects invalid SteamIDs and classifies unavailable API errors as retryable', async () => {
    await expect(createSteamClient({ apiKey: 'test-key', http: { get: jest.fn() } }).listOwnedGames('bad')).rejects.toBeInstanceOf(SteamProviderError);
    await expect(createSteamClient({ apiKey: 'test-key', http: { get: jest.fn().mockRejectedValue({ response: { status: 503 } }) } }).listOwnedGames('76561198000000000')).rejects.toMatchObject({ retryable: true });
  });
  test('gives actionable diagnostics for Steam access and configuration failures', async () => {
    expect(() => createSteamClient({ apiKey: null })).toThrow('STEAM_API_KEY is not configured');
    await expect(createSteamClient({ apiKey: 'test-key', http: { get: jest.fn().mockRejectedValue({ response: { status: 403 } }) } }).listOwnedGames('76561198000000000')).rejects.toMatchObject({ code: 'steam_access_denied', retryable: false });
  });
});