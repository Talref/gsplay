const Request = require('../../src/core/models/DrRacoonRequest');
const Content = require('../../src/core/models/DrRacoonContent');
const { createDrRacoonQueue } = require('../../src/core/jobs/drRacoonQueue');
const source = (id, extra = {}) => ({
  id,
  guildId: 'guild',
  channelId: 'channel',
  authorId: 'alice',
  scope: 'user',
  ...extra
});
let clock, queue;
beforeEach(async () => {
  await global.testUtils.cleanupDatabase();
  clock = Date.now();
  queue = createDrRacoonQueue({ limit: 20, guildIds: ['guild'], now: () => new Date(clock) });
});

test('deduplicates concurrent admission and rejects queue/user overflow', async () => {
  const results = await Promise.all([
    queue.admit(source('1'), 'hello'),
    queue.admit(source('1'), 'hello')
  ]);
  expect(results.map((r) => r.duplicate)).toEqual([false, true]);
  await queue.admit(source('2'), 'hello');
  await expect(queue.admit(source('3'), 'hello')).rejects.toThrow('rate_limited');
  const tiny = createDrRacoonQueue({ limit: 2, guildIds: ['guild'] });
  await expect(tiny.admit(source('4', { authorId: 'bob' }), 'hello')).rejects.toThrow('queue_full');
  await expect(queue.admit(source('5', { guildId: 'other' }), 'hello')).rejects.toThrow(
    'guild_not_allowed'
  );
});

test('claims atomically, renews, fences expired owners and recovers admission/retries', async () => {
  await queue.admit(source('1'), 'hello');
  expect(await queue.claim()).toBeNull();
  await queue.activate('1');
  const claims = await Promise.all([queue.claim(), queue.claim()]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  const first = claims.find(Boolean);
  clock += 10000;
  await queue.renew(first);
  clock += 20001;
  expect(await queue.claim()).toBeNull();
  clock += 10000;
  const second = await queue.claim();
  expect(second.attempts).toBe(2);
  await expect(queue.finish(first)).rejects.toThrow('lease_lost');
  await queue.retry(second, 'provider_unavailable');
  expect(await queue.claim()).toBeNull();
  clock += 5000;
  const third = await queue.claim();
  await queue.finish(third, 'attempts_exhausted');
  expect(await Request.findById('1')).toMatchObject({
    status: 'failed',
    failureCode: 'attempts_exhausted'
  });
  await queue.admit(source('2'), 'hello');
  clock += 30001;
  expect((await queue.claim())._id).toBe('2');
});

test('shared ancestry persists across instances without mixing guild/channel/scope', async () => {
  await queue.admit(source('1'), 'original');
  await queue.activate('1');
  const job = await queue.claim();
  await queue.update(job, { responseIds: ['response'] });
  await Content.updateOne(
    { _id: '1' },
    { $set: { output: 'explanation', inferenceComplete: true } }
  );
  await queue.finish(job);
  const restarted = createDrRacoonQueue({ guildIds: ['guild'] });
  const continuation = source('2', { authorId: 'bob', parentRequestId: '1' });
  expect(await restarted.history(continuation)).toEqual([
    { input: 'original', output: 'explanation' }
  ]);
  for (const boundary of [{ guildId: 'other' }, { channelId: 'other' }, { scope: 'staff' }]) {
    expect(await restarted.history({ ...continuation, ...boundary })).toEqual([]);
  }
  expect(await restarted.parentForMessage({ ...source('2'), messageId: 'response' })).toMatchObject(
    { _id: '1' }
  );
  await Content.updateOne({ _id: '1' }, { $set: { expiresAt: new Date(0) } });
  expect(await restarted.history(continuation)).toEqual([]);
});

test('rate limits remain effective after restart and metadata/content have distinct retention', async () => {
  for (let index = 0; index < 6; index++) {
    await queue.admit(source(String(index)), 'hello');
    await queue.activate(String(index));
    await queue.finish(await queue.claim());
  }
  const restarted = createDrRacoonQueue({ guildIds: ['guild'] });
  await expect(restarted.admit(source('7'), 'hello')).rejects.toThrow('rate_limited');
  const [job, body] = await Promise.all([Request.findById('0'), Content.findById('0')]);
  expect(job.expiresAt - body.expiresAt).toBeGreaterThan(22 * 86400000);
});
