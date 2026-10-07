const ScheduledJob = require('../../src/core/models/ScheduledJob');
const {
  claimDueScheduledJob,
  markScheduledJobReady
} = require('../../src/core/jobs/scheduledJobService');
const {
  TEMPORARY_TAG_EXPIRATION_JOB_TYPE,
  createTemporaryTag
} = require('../../src/core/services/temporaryTagService');
const {
  createTemporaryTagExpirationDelivery
} = require('../../src/gsbot/features/temporaryTagExpirationDelivery');

describe('temporary tag expiration delivery', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  const guildId = '123456789012345678';

  async function readyExpiration({
    targetGuildId = guildId,
    discordRoleId = '223456789012345678',
    name = 'Halloween'
  } = {}) {
    const now = new Date('2026-10-03T12:00:00.000Z');
    const tag = await createTemporaryTag(
      {
        guildId: targetGuildId,
        discordRoleId,
        name,
        buttonLabel: '🎃 Partecipa',
        expiresAt: new Date('2026-10-03T13:00:00.000Z'),
        createdBy: '323456789012345678'
      },
      now
    );
    await ScheduledJob.updateOne(
      { type: TEMPORARY_TAG_EXPIRATION_JOB_TYPE, 'payload.tagId': tag.id },
      { $set: { runAt: new Date(0), nextAttemptAt: new Date(0) } }
    );
    const preparing = await claimDueScheduledJob('worker');
    await markScheduledJobReady(preparing);
    return tag;
  }

  test('hands expiration cleanup to GSbot and completes the persistent job', async () => {
    const tag = await readyExpiration();
    const cleanup = { cleanup: jest.fn().mockResolvedValue({ status: 'deleted' }) };
    const delivery = createTemporaryTagExpirationDelivery({
      cleanup,
      guildIds: [guildId],
      log: { info: jest.fn(), error: jest.fn() }
    });
    await delivery.drain();
    expect(cleanup.cleanup).toHaveBeenCalledWith(tag.id, { guildId });
    expect(await ScheduledJob.findOne()).toMatchObject({ status: 'completed', attempts: 1 });
  });

  test('leaves a failed Discord cleanup retryable after restart', async () => {
    await readyExpiration();
    const cleanup = { cleanup: jest.fn().mockRejectedValue(new Error('Discord unavailable')) };
    const delivery = createTemporaryTagExpirationDelivery({
      cleanup,
      guildIds: [guildId],
      log: { info: jest.fn(), error: jest.fn() }
    });
    await delivery.drain();
    expect(await ScheduledJob.findOne()).toMatchObject({
      status: 'ready',
      attempts: 1,
      lastError: 'Discord unavailable'
    });
  });

  test('claims expiration work for configured guilds and leaves unconfigured work untouched', async () => {
    const secondGuildId = '423456789012345678';
    const unconfiguredGuildId = '623456789012345678';
    const secondTag = await readyExpiration({
      targetGuildId: secondGuildId,
      discordRoleId: '523456789012345678',
      name: 'Altro server'
    });
    const unconfiguredTag = await readyExpiration({
      targetGuildId: unconfiguredGuildId,
      discordRoleId: '723456789012345678',
      name: 'Server escluso'
    });
    const tag = await readyExpiration();
    const cleanup = { cleanup: jest.fn().mockResolvedValue({ status: 'deleted' }) };
    const delivery = createTemporaryTagExpirationDelivery({
      cleanup,
      guildIds: [guildId, secondGuildId],
      log: { info: jest.fn(), error: jest.fn() }
    });

    await delivery.drain();

    expect(cleanup.cleanup).toHaveBeenCalledTimes(2);
    expect(cleanup.cleanup).toHaveBeenCalledWith(tag.id, { guildId });
    expect(cleanup.cleanup).toHaveBeenCalledWith(secondTag.id, { guildId: secondGuildId });
    expect(await ScheduledJob.findOne({ 'payload.tagId': tag.id })).toMatchObject({
      status: 'completed',
      attempts: 1
    });
    expect(await ScheduledJob.findOne({ 'payload.tagId': secondTag.id })).toMatchObject({
      status: 'completed',
      attempts: 1
    });
    expect(await ScheduledJob.findOne({ 'payload.tagId': unconfiguredTag.id })).toMatchObject({
      status: 'ready',
      attempts: 0
    });
  });
});
