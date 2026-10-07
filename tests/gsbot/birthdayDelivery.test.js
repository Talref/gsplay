const Birthday = require('../../src/core/models/Birthday');
const GsbotGuildConfig = require('../../src/core/models/GsbotGuildConfig');
const ScheduledJob = require('../../src/core/models/ScheduledJob');
const {
  claimDueScheduledJob,
  claimReadyScheduledJob,
  enqueueScheduledJob,
  markScheduledJobReady
} = require('../../src/core/jobs/scheduledJobService');
const { createBirthdayDelivery } = require('../../src/gsbot/features/birthdayDelivery');

describe('GSbot birthday delivery', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('sends to general with only the birthday user mention enabled', async () => {
    const guildId = '12345678901234567';
    const discordUserId = '23456789012345678';
    const channelId = '1338850451076026389';
    await Promise.all([
      Birthday.create({ guildId, discordUserId, day: 4, month: 7 }),
      GsbotGuildConfig.create({ guildId, channels: { general: channelId } })
    ]);
    await enqueueScheduledJob({
      type: 'birthday_reminder',
      payload: { guildId, discordUserId, occurrenceYear: 2026 },
      runAt: new Date(0),
      dedupeKey: `birthday:${guildId}:${discordUserId}:2026`
    });
    const preparing = await claimDueScheduledJob('worker-a');
    await markScheduledJobReady(preparing);
    const job = await claimReadyScheduledJob('gsbot-test', { types: ['birthday_reminder'] });
    const send = jest.fn().mockResolvedValue({ id: 'discord-message' });
    const client = {
      channels: {
        fetch: jest.fn().mockResolvedValue({ isTextBased: () => true, send })
      }
    };
    const delivery = createBirthdayDelivery({
      client,
      guildIds: [guildId],
      log: { info: jest.fn(), error: jest.fn() }
    });

    await delivery.deliver(job);

    expect(client.channels.fetch).toHaveBeenCalledWith(channelId);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining(`<@${discordUserId}>`),
        allowedMentions: { parse: [], users: [discordUserId], repliedUser: false },
        nonce: job.id,
        enforceNonce: true
      })
    );
    expect(await ScheduledJob.findById(job.id)).toMatchObject({
      status: 'completed',
      deliveryMessageId: 'discord-message'
    });
    expect(await ScheduledJob.countDocuments({ status: 'scheduled' })).toBe(1);
  });

  test('claims birthday work for configured guilds and leaves unconfigured work untouched', async () => {
    const guildId = '123456789012345678';
    const secondGuildId = '223456789012345678';
    const unconfiguredGuildId = '323456789012345678';
    const discordUserId = '323456789012345678';
    const otherDiscordUserId = '423456789012345678';
    const unconfiguredDiscordUserId = '523456789012345678';
    const channelId = '523456789012345678';
    const secondChannelId = '623456789012345678';
    await Promise.all([
      Birthday.create({ guildId, discordUserId, day: 4, month: 7 }),
      Birthday.create({
        guildId: secondGuildId,
        discordUserId: otherDiscordUserId,
        day: 5,
        month: 8
      }),
      Birthday.create({
        guildId: unconfiguredGuildId,
        discordUserId: unconfiguredDiscordUserId,
        day: 6,
        month: 9
      }),
      GsbotGuildConfig.create({ guildId, channels: { general: channelId } }),
      GsbotGuildConfig.create({
        guildId: secondGuildId,
        channels: { general: secondChannelId }
      })
    ]);
    await enqueueScheduledJob({
      type: 'birthday_reminder',
      payload: { guildId: secondGuildId, discordUserId: otherDiscordUserId, occurrenceYear: 2026 },
      runAt: new Date(0),
      dedupeKey: `birthday:${secondGuildId}:${otherDiscordUserId}:2026`
    });
    await enqueueScheduledJob({
      type: 'birthday_reminder',
      payload: { guildId, discordUserId, occurrenceYear: 2026 },
      runAt: new Date(0),
      dedupeKey: `birthday:${guildId}:${discordUserId}:2026`
    });
    await enqueueScheduledJob({
      type: 'birthday_reminder',
      payload: {
        guildId: unconfiguredGuildId,
        discordUserId: unconfiguredDiscordUserId,
        occurrenceYear: 2026
      },
      runAt: new Date(0),
      dedupeKey: `birthday:${unconfiguredGuildId}:${unconfiguredDiscordUserId}:2026`
    });
    for (let index = 0; index < 3; index += 1) {
      const preparing = await claimDueScheduledJob('worker-a');
      await markScheduledJobReady(preparing);
    }
    const send = jest.fn().mockResolvedValue({ id: 'discord-message' });
    const client = {
      channels: {
        fetch: jest.fn().mockResolvedValue({ isTextBased: () => true, send })
      }
    };
    const delivery = createBirthdayDelivery({
      client,
      guildIds: [guildId, secondGuildId],
      log: { info: jest.fn(), error: jest.fn() }
    });

    await delivery.drain();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.map(([message]) => message.content)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`<@${discordUserId}>`),
        expect.stringContaining(`<@${otherDiscordUserId}>`)
      ])
    );
    expect(
      await ScheduledJob.findOne({
        type: 'birthday_reminder',
        'payload.guildId': guildId,
        status: 'completed'
      })
    ).not.toBeNull();
    expect(
      await ScheduledJob.findOne({
        type: 'birthday_reminder',
        'payload.guildId': secondGuildId,
        status: 'completed'
      })
    ).not.toBeNull();
    expect(
      await ScheduledJob.findOne({
        type: 'birthday_reminder',
        'payload.guildId': unconfiguredGuildId
      })
    ).toMatchObject({ status: 'ready', attempts: 0 });
  });
});
