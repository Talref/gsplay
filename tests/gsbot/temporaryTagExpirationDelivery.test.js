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

  async function readyExpiration() {
    const now = new Date('2026-10-03T12:00:00.000Z');
    const tag = await createTemporaryTag(
      {
        guildId: '123456789012345678',
        discordRoleId: '223456789012345678',
        name: 'Halloween',
        buttonLabel: '🎃 Partecipa',
        expiresAt: new Date('2026-10-03T13:00:00.000Z'),
        createdBy: '323456789012345678'
      },
      now
    );
    await ScheduledJob.updateOne(
      { type: TEMPORARY_TAG_EXPIRATION_JOB_TYPE },
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
      log: { info: jest.fn(), error: jest.fn() }
    });
    await delivery.drain();
    expect(cleanup.cleanup).toHaveBeenCalledWith(tag.id);
    expect(await ScheduledJob.findOne()).toMatchObject({ status: 'completed', attempts: 1 });
  });

  test('leaves a failed Discord cleanup retryable after restart', async () => {
    await readyExpiration();
    const cleanup = { cleanup: jest.fn().mockRejectedValue(new Error('Discord unavailable')) };
    const delivery = createTemporaryTagExpirationDelivery({
      cleanup,
      log: { info: jest.fn(), error: jest.fn() }
    });
    await delivery.drain();
    expect(await ScheduledJob.findOne()).toMatchObject({
      status: 'ready',
      attempts: 1,
      lastError: 'Discord unavailable'
    });
  });
});
