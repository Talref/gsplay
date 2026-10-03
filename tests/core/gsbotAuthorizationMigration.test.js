const GsbotGuildConfig = require('../../src/core/models/GsbotGuildConfig');
const { removeObsoleteTagAuthorization } = require('../../src/core/migrations/gsbotAuthorization');

describe('GSbot authorization migration', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('removes the obsolete staff-role mapping without changing channel configuration', async () => {
    const guildId = '123456789012345678';
    await GsbotGuildConfig.collection.insertOne({
      guildId,
      channels: { general: '223456789012345678' },
      roles: { staff: '1555940533216616518' }
    });

    expect((await removeObsoleteTagAuthorization()).modifiedCount).toBe(1);
    const migrated = await GsbotGuildConfig.collection.findOne({ guildId });
    expect(migrated).toMatchObject({
      channels: { general: '223456789012345678' }
    });
    expect(migrated.roles).toBeUndefined();
  });
});
