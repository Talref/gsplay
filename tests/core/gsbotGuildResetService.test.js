const Birthday = require('../../src/core/models/Birthday');
const GsbotGuildConfig = require('../../src/core/models/GsbotGuildConfig');
const ScheduledJob = require('../../src/core/models/ScheduledJob');
const TemporaryTag = require('../../src/core/models/TemporaryTag');
const TemporaryTagInvite = require('../../src/core/models/TemporaryTagInvite');
const User = require('../../src/core/models/User');
const { enqueueScheduledJob } = require('../../src/core/jobs/scheduledJobService');
const { runGsbotGuildReset } = require('../../scripts/reset-gsbot-guild');

const targetGuildId = '123456789012345678';
const otherGuildId = '223456789012345678';

function commandOptions(overrides = {}) {
  return {
    argumentsList: ['--guild-id', targetGuildId, '--confirm', targetGuildId],
    mongoUri: process.env.MONGO_URI,
    output: { info: jest.fn(), error: jest.fn() },
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

async function createGuildRecords(guildId, suffix) {
  const tag = await TemporaryTag.create({
    guildId,
    discordRoleId: `${suffix}34567890123456789`,
    name: `Tag ${suffix}`,
    normalizedName: `tag-${suffix}`,
    buttonLabel: `Join ${suffix}`,
    createdBy: `${suffix}45678901234567890`
  });
  await Promise.all([
    Birthday.create({
      guildId,
      discordUserId: `${suffix}56789012345678901`,
      day: 4,
      month: 7
    }),
    GsbotGuildConfig.create({
      guildId,
      channels: { general: `${suffix}67890123456789012` }
    }),
    TemporaryTagInvite.create({
      tagId: tag._id,
      guildId,
      channelId: `${suffix}78901234567890123`,
      messageId: `${suffix}89012345678901234`,
      createdBy: `${suffix}45678901234567890`
    }),
    enqueueScheduledJob({
      type: 'birthday_reminder',
      payload: { guildId },
      runAt: new Date('2030-01-01T00:00:00.000Z'),
      dedupeKey: `birthday:${guildId}`
    }),
    enqueueScheduledJob({
      type: 'temporary_tag_expiration',
      payload: { guildId, tagId: tag.id },
      runAt: new Date('2030-01-02T00:00:00.000Z'),
      dedupeKey: `tag:${guildId}`
    })
  ]);
}

describe('GSbot guild reset', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test.each([
    {
      name: 'missing confirmation',
      argumentsList: ['--guild-id', targetGuildId],
      message: '--confirm is required'
    },
    {
      name: 'mismatched confirmation',
      argumentsList: ['--guild-id', targetGuildId, '--confirm', otherGuildId],
      message: '--confirm must exactly match the guild ID'
    }
  ])('$name aborts before connecting or deleting', async ({ argumentsList, message }) => {
    await Birthday.create({
      guildId: targetGuildId,
      discordUserId: '323456789012345678',
      day: 4,
      month: 7
    });
    const options = commandOptions({ argumentsList });

    await expect(runGsbotGuildReset(options)).rejects.toThrow(message);

    expect(options.connect).not.toHaveBeenCalled();
    expect(await Birthday.countDocuments({ guildId: targetGuildId })).toBe(1);
  });

  test('matching confirmation removes only the target guild GSbot records and reports counts', async () => {
    await Promise.all([
      createGuildRecords(targetGuildId, '1'),
      createGuildRecords(otherGuildId, '2'),
      User.create({
        usernameNormalized: 'unrelated-user',
        usernameDisplay: 'Unrelated User',
        passwordHash: 'not-a-real-hash'
      }),
      enqueueScheduledJob({
        type: 'unrelated_application_job',
        payload: { guildId: targetGuildId },
        runAt: new Date('2030-01-03T00:00:00.000Z'),
        dedupeKey: `unrelated:${targetGuildId}`
      })
    ]);
    const options = commandOptions();

    const counts = await runGsbotGuildReset(options);

    expect(counts).toEqual({
      birthdays: 1,
      guildConfigurations: 1,
      temporaryTags: 1,
      temporaryTagInvites: 1,
      scheduledJobs: 2
    });
    expect(options.output.info.mock.calls.map(([message]) => message)).toEqual([
      `Resetting GSbot data for guild ${targetGuildId}...`,
      `Reset complete for GSbot guild ${targetGuildId}:`,
      '  birthdays: 1',
      '  guild configurations: 1',
      '  temporary tags: 1',
      '  temporary tag invites: 1',
      '  scheduled jobs: 2'
    ]);
    expect(options.connect).toHaveBeenCalledWith({ mongoUri: process.env.MONGO_URI });
    expect(options.disconnect).toHaveBeenCalledTimes(1);

    expect(await Birthday.countDocuments({ guildId: targetGuildId })).toBe(0);
    expect(await GsbotGuildConfig.countDocuments({ guildId: targetGuildId })).toBe(0);
    expect(await TemporaryTag.countDocuments({ guildId: targetGuildId })).toBe(0);
    expect(await TemporaryTagInvite.countDocuments({ guildId: targetGuildId })).toBe(0);
    expect(
      await ScheduledJob.countDocuments({
        type: 'birthday_reminder',
        'payload.guildId': targetGuildId
      })
    ).toBe(0);
    expect(
      await ScheduledJob.countDocuments({
        type: 'temporary_tag_expiration',
        'payload.guildId': targetGuildId
      })
    ).toBe(0);

    expect(await Birthday.countDocuments({ guildId: otherGuildId })).toBe(1);
    expect(await GsbotGuildConfig.countDocuments({ guildId: otherGuildId })).toBe(1);
    expect(await TemporaryTag.countDocuments({ guildId: otherGuildId })).toBe(1);
    expect(await TemporaryTagInvite.countDocuments({ guildId: otherGuildId })).toBe(1);
    expect(await ScheduledJob.countDocuments({ 'payload.guildId': otherGuildId })).toBe(2);
    expect(await ScheduledJob.countDocuments({ type: 'unrelated_application_job' })).toBe(1);
    expect(await User.countDocuments()).toBe(1);
  });
});
