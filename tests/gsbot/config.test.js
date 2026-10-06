const { gsbotDeploymentMode, loadGsbotEnvironment } = require('../../src/gsbot/config');

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
    ).toEqual({
      token: 'discord-token',
      guildId: '123456789012345678',
      mongoUri: 'mongodb://127.0.0.1:27017/gsplay'
    });
    expect(() =>
      loadGsbotEnvironment({ GSBOT_TOKEN: 'discord-token', GSBOT_GUILD_ID: 'not-a-server' })
    ).toThrow('GSBOT_GUILD_ID must be a Discord server ID');
  });

  test('only disables deployment when both GSbot bootstrap values are absent', () => {
    expect(gsbotDeploymentMode({})).toBe('disabled');
    expect(gsbotDeploymentMode({ GSBOT_TOKEN: ' ', GSBOT_GUILD_ID: '' })).toBe('disabled');
    expect(() => gsbotDeploymentMode({ GSBOT_TOKEN: 'discord-token' })).toThrow(
      'GSBOT_GUILD_ID is required'
    );
    expect(() =>
      gsbotDeploymentMode({ GSBOT_TOKEN: 'discord-token', GSBOT_GUILD_ID: '   ' })
    ).toThrow('GSBOT_GUILD_ID is required');
    expect(() =>
      gsbotDeploymentMode({ GSBOT_TOKEN: 'discord-token', GSBOT_GUILD_ID: 'invalid' })
    ).toThrow('GSBOT_GUILD_ID must be a Discord server ID');
    expect(
      gsbotDeploymentMode({
        GSBOT_TOKEN: 'discord-token',
        GSBOT_GUILD_ID: '123456789012345678'
      })
    ).toBe('enabled');
  });
});
