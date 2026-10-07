const { gsbotDeploymentMode, loadGsbotEnvironment } = require('../../src/gsbot/config');

describe('GSbot environment configuration', () => {
  test('requires both Discord bootstrap values', () => {
    expect(() => loadGsbotEnvironment({})).toThrow('GSBOT_TOKEN is required');
    expect(() => loadGsbotEnvironment({ GSBOT_TOKEN: 'discord-token' })).toThrow(
      'GSBOT_GUILD_IDS or GSBOT_GUILD_ID is required'
    );
  });

  test('validates, deduplicates, and returns all target guilds', () => {
    expect(
      loadGsbotEnvironment({
        GSBOT_TOKEN: 'discord-token',
        GSBOT_GUILD_IDS:
          '123456789012345678, 223456789012345678,123456789012345678'
      })
    ).toEqual({
      token: 'discord-token',
      guildIds: ['123456789012345678', '223456789012345678'],
      mongoUri: 'mongodb://127.0.0.1:27017/gsplay'
    });
    expect(() =>
      loadGsbotEnvironment({ GSBOT_TOKEN: 'discord-token', GSBOT_GUILD_IDS: 'not-a-server' })
    ).toThrow('GSBOT_GUILD_IDS must contain only Discord server IDs separated by commas');
    expect(() =>
      loadGsbotEnvironment({
        GSBOT_TOKEN: 'discord-token',
        GSBOT_GUILD_IDS: '123456789012345678,'
      })
    ).toThrow('GSBOT_GUILD_IDS must contain only Discord server IDs separated by commas');
  });

  test('accepts the legacy single-guild variable as a migration path', () => {
    expect(
      loadGsbotEnvironment({
        GSBOT_TOKEN: 'discord-token',
        GSBOT_GUILD_ID: '123456789012345678'
      })
    ).toEqual({
      token: 'discord-token',
      guildIds: ['123456789012345678'],
      mongoUri: 'mongodb://127.0.0.1:27017/gsplay'
    });
    expect(() =>
      loadGsbotEnvironment({ GSBOT_TOKEN: 'discord-token', GSBOT_GUILD_ID: 'not-a-server' })
    ).toThrow('GSBOT_GUILD_ID must be a Discord server ID');
  });

  test('only disables deployment when both GSbot bootstrap values are absent', () => {
    expect(gsbotDeploymentMode({})).toBe('disabled');
    expect(gsbotDeploymentMode({ GSBOT_TOKEN: ' ', GSBOT_GUILD_IDS: '' })).toBe('disabled');
    expect(() => gsbotDeploymentMode({ GSBOT_TOKEN: 'discord-token' })).toThrow(
      'GSBOT_GUILD_IDS or GSBOT_GUILD_ID is required'
    );
    expect(() =>
      gsbotDeploymentMode({ GSBOT_TOKEN: 'discord-token', GSBOT_GUILD_IDS: '   ' })
    ).toThrow('GSBOT_GUILD_IDS or GSBOT_GUILD_ID is required');
    expect(() =>
      gsbotDeploymentMode({ GSBOT_TOKEN: 'discord-token', GSBOT_GUILD_IDS: 'invalid' })
    ).toThrow('GSBOT_GUILD_IDS must contain only Discord server IDs separated by commas');
    expect(
      gsbotDeploymentMode({
        GSBOT_TOKEN: 'discord-token',
        GSBOT_GUILD_IDS: '123456789012345678,223456789012345678'
      })
    ).toBe('enabled');
  });
});
