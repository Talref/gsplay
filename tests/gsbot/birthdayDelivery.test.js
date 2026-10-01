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
    const delivery = createBirthdayDelivery({ client, log: { info: jest.fn(), error: jest.fn() } });

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
});
