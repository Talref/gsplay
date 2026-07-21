const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const User = require('../../src/v2/models/User');
const CanonicalGame = require('../../src/v2/models/CanonicalGame');
const SyncJob = require('../../src/v2/models/SyncJob');

const config = loadEnvironment({ NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test', JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32) });
const app = createApp(config);
const password = 'correct-horse-battery-staple';

async function createUser(username, role = 'member') {
  return User.create({ usernameNormalized: User.normalizeUsername(username), usernameDisplay: username, role, passwordHash: await User.hashPassword(password) });
}

async function login(username) {
  const agent = request.agent(app);
  await agent.post('/api/v2/auth/login').send({ username, password }).expect(200);
  return agent;
}

describe('v2 admin metadata refresh', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('queues one durable refresh and coalesces duplicate active requests', async () => {
    await createUser('Refresh Member');
    await createUser('Refresh Admin', 'admin');
    const game = await CanonicalGame.create({ canonicalTitle: 'Aqua Quest', normalizedTitle: 'aqua quest' });
    const member = await login('Refresh Member');
    const admin = await login('Refresh Admin');

    await member.post(`/api/v2/admin/games/${game._id}/metadata-refresh`).expect(403);
    const first = await admin.post(`/api/v2/admin/games/${game._id}/metadata-refresh`).expect(202);
    expect(first.body.coalesced).toBe(false);

    const stored = await SyncJob.findById(first.body.job._id).select('+payload');
    expect(stored).toMatchObject({ provider: 'igdb', kind: 'metadata_enrichment', status: 'queued' });
    expect(stored.payload.canonicalGameId).toBe(game._id.toString());

    const second = await admin.post(`/api/v2/admin/games/${game._id}/metadata-refresh`).expect(202);
    expect(second.body).toMatchObject({ coalesced: true, job: { _id: first.body.job._id } });
    expect(await SyncJob.countDocuments({ provider: 'igdb', kind: 'metadata_enrichment' })).toBe(1);
  });
});