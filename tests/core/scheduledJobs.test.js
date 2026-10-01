const {
  claimDueScheduledJob,
  claimReadyScheduledJob,
  completeScheduledJob,
  enqueueScheduledJob,
  markScheduledJobReady,
  retryScheduledJob
} = require('../../src/core/jobs/scheduledJobService');

describe('persistent scheduled jobs', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('supports independent arbitrary timestamps and durable delivery handoff', async () => {
    const future = await enqueueScheduledJob({
      type: 'future_event',
      payload: { value: 1 },
      runAt: new Date(Date.now() + 60_000),
      dedupeKey: 'future:1'
    });
    const due = await enqueueScheduledJob({
      type: 'birthday_reminder',
      payload: { value: 2 },
      runAt: new Date(0),
      dedupeKey: 'birthday:1'
    });
    expect(await claimDueScheduledJob('worker-a')).toMatchObject({ id: due.id });
    const preparing = await require('../../src/core/models/ScheduledJob')
      .findById(due.id)
      .select('+payload');
    await markScheduledJobReady(preparing);
    const delivering = await claimReadyScheduledJob('gsbot-a', {
      types: ['birthday_reminder']
    });
    expect(delivering).toMatchObject({ id: due.id, status: 'delivering', attempts: 1 });
    expect(
      await completeScheduledJob(delivering, { deliveryMessageId: 'message-1' })
    ).toMatchObject({
      status: 'completed',
      deliveryMessageId: 'message-1'
    });
    expect((await require('../../src/core/models/ScheduledJob').findById(future.id)).status).toBe(
      'scheduled'
    );
  });

  test('deduplicates jobs and leaves failed delivery retryable', async () => {
    const input = {
      type: 'birthday_reminder',
      runAt: new Date(0),
      dedupeKey: 'birthday:same'
    };
    const first = await enqueueScheduledJob(input);
    expect((await enqueueScheduledJob(input)).id).toBe(first.id);
    const preparing = await claimDueScheduledJob('worker-a');
    await markScheduledJobReady(preparing);
    const delivering = await claimReadyScheduledJob('gsbot-a');
    const retried = await retryScheduledJob(delivering, new Error('Discord unavailable'));
    expect(retried).toMatchObject({
      status: 'ready',
      attempts: 1,
      lastError: 'Discord unavailable'
    });
    expect(retried.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('keeps multiple jobs scheduled for the same precise time', async () => {
    const runAt = new Date('2030-05-01T10:15:30.000Z');
    await Promise.all([
      enqueueScheduledJob({ type: 'event', runAt, dedupeKey: 'event:1' }),
      enqueueScheduledJob({ type: 'event', runAt, dedupeKey: 'event:2' })
    ]);
    const ScheduledJob = require('../../src/core/models/ScheduledJob');
    expect(await ScheduledJob.countDocuments({ runAt })).toBe(2);
  });
});
