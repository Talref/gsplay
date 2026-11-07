const { Events, ChannelType } = require('discord.js');
const { fakeDiscord } = require('./fixtures');
const { createDrRacoonQueue } = require('../../src/core/jobs/drRacoonQueue');
const Request = require('../../src/core/models/DrRacoonRequest');
const Content = require('../../src/core/models/DrRacoonContent');
const { createDrracoonRuntime, createDrracoonClient } = require('../../src/drracoon/runtime');
const { createConsumer } = require('../../src/drracoon/queue');
const { createInference } = require('../../src/drracoon/inference');
const { createToolRegistry } = require('../../src/drracoon/tools');
const { resolveAccess } = require('../../src/drracoon/authorization');
const { PLACEHOLDER, FAILURE } = require('../../src/drracoon/messages');

const config = {
  guildIds: ['guild'],
  staffChannelIds: ['staff'],
  staffRoleIds: ['staff-role'],
  maxConcurrent: 1,
  contextSize: 32768,
  maxOutputTokens: 1024,
  maxToolRounds: 3,
  requestTimeoutMs: 1000,
  baseUrl: 'http://fake/v1',
  model: 'fake'
};
const quiet = { info: jest.fn(), warn: jest.fn() };
let f, queue, consumer, runtime, infer;
beforeEach(async () => {
  await global.testUtils.cleanupDatabase();
  f = fakeDiscord();
  queue = createDrRacoonQueue({ guildIds: config.guildIds });
  infer = jest.fn(async ({ input, onTurn }) => {
    const segments = [`Risposta a ${input}`];
    await onTurn(segments, true);
    return { segments, output: segments[0] };
  });
  consumer = createConsumer({
    config,
    client: f.client,
    queue,
    infer,
    compiler: async (scope) => `prompt ${scope}`,
    log: quiet
  });
  runtime = createDrracoonRuntime({
    config,
    client: f.client,
    queue,
    consumer: { start: () => {}, stop: () => consumer.stop(), tick: () => {} },
    log: quiet
  });
});
afterEach(async () => runtime.stop());
const drain = async () => {
  await consumer.tick();
  await consumer.idle();
};

test('replies to an unfinished explanation wait and inherit its completed history', async () => {
  await runtime.handle(f.source('1'));
  const first = await Request.findById('1');
  await runtime.handle(
    f.source('2', {
      author: { id: 'bob' },
      content: 'clarification',
      mentions: { users: new Map() },
      reference: { messageId: first.responseIds[0] }
    })
  );
  expect((await Request.findById('2')).parentRequestId).toBe('1');
  const parent = await queue.claim();
  await drain();
  expect(infer).not.toHaveBeenCalled();
  expect((await Request.findById('2')).attempts).toBe(0);
  await Content.updateOne(
    { _id: '1' },
    { $set: { output: 'explanation', segments: ['explanation'], inferenceComplete: true } }
  );
  await queue.finish(parent);
  await Request.updateOne({ _id: '2' }, { $set: { runAfter: new Date(0) } });
  await drain();
  expect(infer.mock.calls[0][0].history).toEqual([{ input: 'domanda', output: 'explanation' }]);
});

test('only actual mentions/replies trigger once, and another member inherits chain history', async () => {
  await runtime.handle(
    f.source('ignored', { mentions: { users: new Map() }, content: 'Dr. Racoon' })
  );
  await runtime.handle(f.source('bot-source', { author: { id: 'otherbot', bot: true } }));
  await runtime.handle(f.source('other-guild', { guildId: 'other' }));
  expect(await Request.countDocuments()).toBe(0);
  const original = f.source('1');
  await Promise.all([runtime.handle(original), runtime.handle(original)]);
  expect(f.channel.send).toHaveBeenCalledTimes(1);
  expect([...f.records.values()].find((m) => m.author.id === 'bot').content).toBe(PLACEHOLDER);
  await drain();
  const first = await Request.findById('1');
  const continuation = f.source('2', {
    author: { id: 'bob' },
    content: 'Me lo spieghi meglio?',
    mentions: { users: new Map() },
    reference: { messageId: first.responseIds[0], channelId: 'channel', guildId: 'guild' }
  });
  await runtime.handle(continuation);
  await drain();
  expect(infer.mock.calls[1][0].history).toEqual([
    { input: 'domanda', output: 'Risposta a domanda' }
  ]);
  expect((await Request.findById('2')).status).toBe('completed');
});

test('USER/STAFF requires configured destination and member role; threads inherit parent mapping', async () => {
  f.roles.set('alice', ['staff-role']);
  expect(
    (
      await resolveAccess(
        { guildId: 'guild', channelId: 'channel', authorId: 'alice' },
        { config, client: f.client }
      )
    ).scope
  ).toBe('user');
  const staffConfig = { ...config, staffChannelIds: ['channel'] };
  expect(
    (
      await resolveAccess(
        { guildId: 'guild', channelId: 'channel', authorId: 'alice' },
        { config: staffConfig, client: f.client }
      )
    ).scope
  ).toBe('staff');
  expect(
    (
      await resolveAccess(
        { guildId: 'guild', channelId: 'channel', authorId: 'bob' },
        { config: staffConfig, client: f.client }
      )
    ).scope
  ).toBe('user');
  f.channel.type = ChannelType.PrivateThread;
  f.channel.isThread = () => true;
  f.channel.parentId = 'staff';
  expect(
    (
      await resolveAccess(
        { guildId: 'guild', channelId: 'channel', authorId: 'alice' },
        { config, client: f.client }
      )
    ).scope
  ).toBe('staff');
  f.denied.add('alice');
  await expect(
    resolveAccess(
      { guildId: 'guild', channelId: 'channel', authorId: 'alice' },
      { config, client: f.client }
    )
  ).rejects.toThrow('channel_access_denied');
});

test('queued jobs recheck authorization and never compile/fall back after staff scope is revoked', async () => {
  await queue.admit(
    { id: '1', guildId: 'guild', channelId: 'channel', authorId: 'alice', scope: 'staff' },
    'secret'
  );
  f.source('1');
  await queue.activate('1');
  await drain();
  expect(infer).not.toHaveBeenCalled();
  expect((await Request.findById('1')).failureCode).toBe('authorization_changed');
  expect(f.channel.send).not.toHaveBeenCalled();
});

test('one inference slot, clean shutdown and durable recovery without rerunning completed inference', async () => {
  let release;
  infer.mockImplementationOnce(
    ({ signal }) =>
      new Promise((resolve, reject) => {
        release = resolve;
        signal.addEventListener('abort', () => reject(new Error('request_cancelled')), {
          once: true
        });
      })
  );
  await runtime.handle(f.source('1'));
  await runtime.handle(f.source('2', { author: { id: 'bob' } }));
  await consumer.tick();
  for (let index = 0; index < 100 && !release; index++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  expect(infer).toHaveBeenCalledTimes(1);
  expect(await Request.countDocuments({ status: 'running' })).toBe(1);
  await consumer.stop();
  expect(await Request.countDocuments({ status: 'running' })).toBe(0);
  // Simulate inference checkpoint saved immediately before a process exit.
  await Content.updateOne(
    { _id: '1' },
    { $set: { segments: ['Saved answer'], output: 'Saved answer', inferenceComplete: true } }
  );
  await Request.updateOne({ _id: '1' }, { $set: { runAfter: new Date(0) } });
  const restarted = createConsumer({
    config,
    client: f.client,
    queue,
    infer,
    compiler: async () => 'prompt',
    log: quiet
  });
  await restarted.tick();
  await restarted.idle();
  expect(f.records.get((await Request.findById('1')).responseIds[0]).content).toBe('Saved answer');
  expect(infer).toHaveBeenCalledTimes(1);
  await restarted.stop();
});

test('bounded retries replace failed placeholders and provider errors do not stop later requests', async () => {
  infer
    .mockRejectedValueOnce(new Error('provider_unavailable'))
    .mockRejectedValueOnce(new Error('provider_unavailable'))
    .mockRejectedValueOnce(new Error('provider_unavailable'));
  await runtime.handle(f.source('1'));
  for (let attempt = 0; attempt < 3; attempt++) {
    await Request.updateOne({ _id: '1' }, { $set: { runAfter: new Date(0) } });
    await drain();
  }
  const failed = await Request.findById('1');
  expect(failed.status).toBe('failed');
  expect(f.records.get(failed.responseIds[0]).content).toBe(FAILURE);
  await runtime.handle(f.source('2'));
  await drain();
  expect((await Request.findById('2')).status).toBe('completed');
});

test('simulated tool round-trip drives preliminary edit and final append through real orchestration', async () => {
  const tool = {
    name: 'example',
    description: 'test only',
    parameters: { type: 'object' },
    allowed: () => true,
    validate: (args) => Object.keys(args).length === 0,
    execute: async () => ({ value: '42' })
  };
  const response = (message) =>
    new Response(JSON.stringify({ choices: [{ message, finish_reason: 'stop' }] }), {
      headers: { 'content-type': 'application/json' }
    });
  const fetchImpl = jest
    .fn()
    .mockResolvedValueOnce(
      response({
        content: 'Controllo.',
        tool_calls: [
          { id: 'test-call', type: 'function', function: { name: 'example', arguments: '{}' } }
        ]
      })
    )
    .mockResolvedValueOnce(response({ content: 'Quarantadue.' }));
  const actual = createInference({ config, registry: createToolRegistry([tool]), fetchImpl });
  const integrated = createConsumer({
    config,
    client: f.client,
    queue,
    infer: actual,
    compiler: async () => 'prompt',
    log: quiet
  });
  await runtime.handle(f.source('1'));
  await integrated.tick();
  await integrated.idle();
  expect(
    [...f.records.values()].filter((m) => m.author.id === 'bot').map((m) => m.content)
  ).toEqual(['Controllo.', 'Quarantadue.']);
  expect((await Request.findById('1')).status).toBe('completed');
  await integrated.stop();
});

test('readiness follows Discord connection and requires no inference availability', async () => {
  const onReady = jest.fn(async () => {}),
    onUnready = jest.fn(async () => {});
  const readyRuntime = createDrracoonRuntime({
    config,
    client: f.client,
    queue,
    consumer: { start: jest.fn(), stop: jest.fn(), tick: jest.fn() },
    onReady,
    onUnready,
    log: quiet
  });
  await readyRuntime.start();
  expect(onReady).toHaveBeenCalledTimes(1);
  f.client.emit(Events.ShardDisconnect);
  await new Promise(setImmediate);
  expect(onUnready).toHaveBeenCalled();
  expect(infer).not.toHaveBeenCalled();
  const actualClient = createDrracoonClient();
  expect(actualClient.options.intents.has('MessageContent')).toBe(true);
  actualClient.destroy();
  await readyRuntime.stop();
});
