const TemporaryTag = require('../../src/core/models/TemporaryTag');
const TemporaryTagInvite = require('../../src/core/models/TemporaryTagInvite');
const { createTemporaryTagCleanup } = require('../../src/gsbot/features/temporaryTagCleanup');

describe('temporary tag cleanup', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('deletes the role, disables every invite, and archives history idempotently', async () => {
    const tag = await TemporaryTag.create({
      guildId: '123456789012345678',
      discordRoleId: '223456789012345678',
      name: 'Halloween',
      normalizedName: 'halloween',
      buttonLabel: '🎃 Partecipa',
      createdBy: '323456789012345678'
    });
    await TemporaryTagInvite.create([
      {
        tagId: tag._id,
        guildId: tag.guildId,
        channelId: '423456789012345678',
        messageId: '523456789012345678',
        createdBy: tag.createdBy
      },
      {
        tagId: tag._id,
        guildId: tag.guildId,
        channelId: '423456789012345679',
        messageId: '523456789012345679',
        createdBy: tag.createdBy
      }
    ]);
    const role = { delete: jest.fn().mockResolvedValue(undefined) };
    const edits = [];
    const client = {
      guilds: {
        fetch: jest.fn().mockResolvedValue({ roles: { fetch: jest.fn().mockResolvedValue(role) } })
      },
      channels: {
        fetch: jest.fn(async (channelId) => ({
          isTextBased: () => true,
          messages: {
            edit: jest.fn(async (messageId, payload) =>
              edits.push({ channelId, messageId, payload })
            )
          }
        }))
      }
    };
    const cleanup = createTemporaryTagCleanup({ client, log: { info: jest.fn() } });
    await cleanup.cleanup(tag, { deletedBy: '323456789012345678' });

    expect(role.delete).toHaveBeenCalledTimes(1);
    expect(edits).toHaveLength(2);
    expect(edits.every(({ payload }) => payload.components[0].components[0].data.disabled)).toBe(
      true
    );
    expect(
      await TemporaryTagInvite.countDocuments({ tagId: tag._id, disabledAt: { $ne: null } })
    ).toBe(2);
    expect(await TemporaryTag.findById(tag.id)).toMatchObject({
      status: 'deleted',
      deletedBy: '323456789012345678'
    });

    await cleanup.cleanup(tag.id);
    expect(role.delete).toHaveBeenCalledTimes(1);
  });
});
