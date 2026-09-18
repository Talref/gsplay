const { loadGsbotEnvironment } = require('../../src/gsbot/config');

describe('GSbot environment configuration', () => {
  test('requires both Discord bootstrap values', () => {
    expect(() => loadGsbotEnvironment({})).toThrow('GSBOT_TOKEN is required');
    expect(() => loadGsbotEnvironment({ GSBOT_TOKEN: 'discord-token' })).toThrow(
      'GSBOT_GUILD_ID is required'
    );
  });

  test('validates and returns the target guild configuration', () => {
    expect(
      loadGsbotEnvironment({ GSBOT_TOKEN: 'discord-token', GSBOT_GUILD_ID: '123456789012345678' })
    ).toEqual({ token: 'discord-token', guildId: '123456789012345678' });
    expect(() =>
      loadGsbotEnvironment({ GSBOT_TOKEN: 'discord-token', GSBOT_GUILD_ID: 'not-a-server' })
    ).toThrow('GSBOT_GUILD_ID must be a Discord server ID');
  });
});
