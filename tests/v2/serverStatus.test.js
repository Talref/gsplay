const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const ServerStatusSnapshot = require('../../src/v2/models/ServerStatusSnapshot');
const { normalizeSnapshot } = require('../../src/v2/services/serverStatusService');

const token = 'server-status-test-token'.padEnd(32, '-');
const config = loadEnvironment({
  NODE_ENV: 'test',
  MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  SERVER_STATUS_INTEGRATION_TOKEN: token,
  SERVER_STATUS_MAX_BYTES: '1024'
});
const app = createApp(config);

const payload = (overrides = {}) => ({
  sourceUpdatedAt: '2026-08-10T12:34:56.000Z',
  servers: [
    {
      groupId: 'landover',
      groupName: 'Landover GS server',
      managerMention: '<@111111111111111111>',
      name: 'GSplay Palworld',
      identifier: '8209baa0',
      status: 'running',
      uptimeMilliseconds: 14276045
    },
    {
      groupId: 'jamserver',
      groupName: 'Jam GS server',
      managerMention: '<@222222222222222222>',
      provider: 'amp',
      name: 'Project Zomboid GS',
      identifier: '64e0cec5-40ae-4369-9af2-17c750810979',
      status: 'idle',
      uptimeMilliseconds: null,
      players: 0,
      maxPlayers: 24,
      ampAppState: 20
    }
  ],
  ...overrides
});

function putStatus(body = payload(), authorization = `Bearer ${token}`) {
  return request(app)
    .put('/api/v2/integrations/server-status')
    .set('Authorization', authorization)
    .send(body);
}

describe('v2 server-status integration', () => {
  beforeEach(() => global.testUtils.cleanupDatabase());

  test('requires the dedicated integration token without accepting user authentication', async () => {
    await request(app).put('/api/v2/integrations/server-status').send(payload()).expect(401);
    await putStatus(payload(), 'Bearer wrong-token').expect(401);
    expect(await ServerStatusSnapshot.countDocuments()).toBe(0);
  });

  test('normalizes the live n8n payload and discards platform-specific fields', async () => {
    const response = await putStatus().expect(200);
    expect(response.body.snapshot).toMatchObject({
      sourceUpdatedAt: '2026-08-10T12:34:56.000Z',
      serverCount: 2
    });
    expect(response.body.snapshot.receivedAt).toBeTruthy();
    const snapshot = await ServerStatusSnapshot.findOne({ singletonKey: 'current' }).lean();
    expect(snapshot.servers).toEqual([
      expect.objectContaining({
        groupId: 'landover',
        identifier: '8209baa0',
        status: 'running',
        uptimeMilliseconds: 14276045
      }),
      expect.objectContaining({
        groupId: 'jamserver',
        status: 'idle',
        players: 0,
        maxPlayers: 24,
        uptimeMilliseconds: null
      })
    ]);
    expect(JSON.stringify(snapshot)).not.toContain('provider');
    expect(JSON.stringify(snapshot)).not.toContain('ampAppState');
  });

  test('atomically replaces the singleton snapshot instead of retaining history', async () => {
    await putStatus().expect(200);
    const replacement = payload({
      sourceUpdatedAt: '2026-08-10T12:35:26.000Z',
      servers: [
        {
          groupId: 'landover',
          groupName: 'Landover GS server',
          name: 'GSplay Palworld',
          identifier: '8209baa0',
          status: 'offline',
          uptimeMilliseconds: null
        }
      ]
    });
    await putStatus(replacement).expect(200);
    expect(await ServerStatusSnapshot.countDocuments()).toBe(1);
    const stored = await ServerStatusSnapshot.findOne().lean();
    expect(stored.sourceUpdatedAt.toISOString()).toBe('2026-08-10T12:35:26.000Z');
    expect(stored.servers).toHaveLength(1);
    expect(stored.servers[0].status).toBe('offline');
  });

  test('accepts every status emitted by the live workflow', () => {
    const statuses = ['running', 'starting', 'stopping', 'offline', 'unknown', 'idle'];
    const normalized = normalizeSnapshot({
      sourceUpdatedAt: '2026-08-10T12:34:56.000Z',
      servers: statuses.map((status, index) => ({
        groupId: 'machine',
        groupName: 'GS server',
        name: `Server ${index}`,
        identifier: `server-${index}`,
        status
      }))
    });
    expect(normalized.servers.map((server) => server.status)).toEqual(statuses);
  });

  test('rejects invalid states, duplicates, mentions, player counts, and unknown fields', async () => {
    const invalidStatus = payload();
    invalidStatus.servers[0].status = 'crashed';
    await putStatus(invalidStatus).expect(400);

    const duplicate = payload();
    duplicate.servers[1].groupId = duplicate.servers[0].groupId;
    duplicate.servers[1].identifier = duplicate.servers[0].identifier;
    await putStatus(duplicate).expect(400);

    const invalidMention = payload();
    invalidMention.servers[0].managerMention = '@everyone';
    await putStatus(invalidMention).expect(400);

    const invalidPlayers = payload();
    invalidPlayers.servers[1].players = 25;
    await putStatus(invalidPlayers).expect(400);

    const conflictingGroup = payload();
    conflictingGroup.servers[1].groupId = conflictingGroup.servers[0].groupId;
    await putStatus(conflictingGroup).expect(400);

    await putStatus({ ...payload(), unexpected: true }).expect(400);
    expect(await ServerStatusSnapshot.countDocuments()).toBe(0);
  });

  test('returns useful errors for malformed and oversized JSON', async () => {
    await request(app)
      .put('/api/v2/integrations/server-status')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send('{"broken":')
      .expect(400);
    const oversized = payload();
    oversized.servers[0].groupName = 'x'.repeat(2000);
    await putStatus(oversized).expect(413);
  });

  test('rate limits bursts while allowing the 30-second update cadence', async () => {
    const limitedConfig = loadEnvironment({
      NODE_ENV: 'development',
      MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      SERVER_STATUS_INTEGRATION_TOKEN: token,
      SERVER_STATUS_RATE_LIMIT_WINDOW_MS: '60000',
      SERVER_STATUS_RATE_LIMIT_MAX: '2'
    });
    const limitedApp = createApp(limitedConfig);
    const update = () =>
      request(limitedApp)
        .put('/api/v2/integrations/server-status')
        .set('Authorization', `Bearer ${token}`)
        .send(payload());
    await update().expect(200);
    await update().expect(200);
    await update().expect(429);
  });
});
