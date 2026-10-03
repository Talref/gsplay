const GsbotGuildConfig = require('../../src/core/models/GsbotGuildConfig');
const { configureGsbot } = require('../../scripts/configure-gsbot');

describe('GSbot semantic configuration', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('adds the staff role without replacing the existing channel', async () => {
    const guildId = '123456789012345678';
    await GsbotGuildConfig.create({
      guildId,
      channels: { general: '223456789012345678' }
    });
    const config = await configureGsbot({
      guildId,
      staffRoleId: '1555940533216616518',
      mongoUri: process.env.MONGO_URI
    });
    expect(config).toMatchObject({
      channels: { general: '223456789012345678' },
      roles: { staff: '1555940533216616518' }
    });
  });
});
