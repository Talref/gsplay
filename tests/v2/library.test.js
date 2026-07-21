const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const User = require('../../src/v2/models/User');
const CanonicalGame = require('../../src/v2/models/CanonicalGame');
const LibraryItem = require('../../src/v2/models/LibraryItem');
const { claimNextJob } = require('../../src/v2/jobs/jobService');
const { createJobHandlers } = require('../../src/v2/jobs/handlers');

const config = loadEnvironment({ NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test', JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32) });
const app = createApp(config);
const password = 'correct-horse-battery-staple';

async function createMember(username) {
  return User.create({ usernameNormalized: User.normalizeUsername(username), usernameDisplay: username, passwordHash: await User.hashPassword(password) });
}
async function authenticate(username) {
  const agent = request.agent(app);
  await agent.post('/api/v2/auth/login').send({ username, password }).expect(200);
  return agent;
}

describe('v2 authoritative library APIs', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('returns only the authenticated user active entitlement library', async () => {
    const member = await createMember('Library User'); const other = await createMember('Other User');
    const game = await CanonicalGame.create({ canonicalTitle: 'Shared Game', normalizedTitle: 'shared game' });
    await LibraryItem.create([{ userId: member._id, provider: 'steam', providerGameId: '1', providerTitle: 'Shared Game', normalizedTitle: 'shared game', canonicalGameId: game._id, matchStatus: 'auto_matched', source: 'api' }, { userId: other._id, provider: 'steam', providerGameId: '1', providerTitle: 'Shared Game', normalizedTitle: 'shared game', canonicalGameId: game._id, matchStatus: 'auto_matched', source: 'api' }, { userId: member._id, provider: 'gog', providerGameId: 'gone', providerTitle: 'Removed', normalizedTitle: 'removed', source: 'api', removedAt: new Date() }]);
    const response = await (await authenticate('Library User')).get('/api/v2/me/library').expect(200);
    expect(response.body.page.total).toBe(1);
    expect(response.body.items[0]).toMatchObject({ providerTitle: 'Shared Game', canonicalGame: { title: 'Shared Game' } });
  });

  test('links only a strict SteamID64 to the authenticated account', async () => {
    await createMember('Steam Link User');
    const agent = await authenticate('Steam Link User');
    const response = await agent.put('/api/v2/me/providers/steam').send({ steamId: '76561198000000000' }).expect(200);
    expect(response.body.steamAccount).toMatchObject({ steamId: '76561198000000000', linkedAt: expect.any(String) });
    await agent.put('/api/v2/me/providers/steam').send({ steamId: 'bad-id' }).expect(400);
    const user = await User.findOne({ usernameNormalized: 'steam link user' });
    expect(user.steamAccount.steamId).toBe('76561198000000000');
  });

  test('validates a bounded CSV import and processes it as an upload job', async () => {
    await createMember('Import User'); const agent = await authenticate('Import User');
    const response = await agent.post('/api/v2/me/imports').field('provider', 'gog').attach('file', Buffer.from('providerGameId,providerTitle\ngog-1,Aqua Quest\n'), { filename: 'library.csv', contentType: 'text/csv' }).expect(202);
    expect(response.body.job.gameCount).toBe(1);
    const job = await claimNextJob('worker');
    await expect(createJobHandlers({ providers: {} }).upload(job)).resolves.toMatchObject({ counts: { created: 1 } });
    expect(await LibraryItem.findOne({ provider: 'gog', providerGameId: 'gog-1', source: 'upload' })).toBeTruthy();
    await agent.post('/api/v2/me/imports').field('provider', 'gog').attach('file', Buffer.from('wrong,header\n1,Aqua\n'), { filename: 'bad.csv', contentType: 'text/csv' }).expect(400);
  });

  test('compares canonical ownership server-side and always includes the caller', async () => {
    const first = await createMember('First User'); const second = await createMember('Second User'); const third = await createMember('Third User');
    const shared = await CanonicalGame.create({ canonicalTitle: 'Shared', normalizedTitle: 'shared' }); const solo = await CanonicalGame.create({ canonicalTitle: 'Solo', normalizedTitle: 'solo' });
    await LibraryItem.create([{ userId: first._id, provider: 'steam', providerGameId: '1', providerTitle: 'Shared', normalizedTitle: 'shared', canonicalGameId: shared._id, matchStatus: 'auto_matched', source: 'api' }, { userId: second._id, provider: 'steam', providerGameId: '2', providerTitle: 'Shared', normalizedTitle: 'shared', canonicalGameId: shared._id, matchStatus: 'auto_matched', source: 'api' }, { userId: third._id, provider: 'steam', providerGameId: '3', providerTitle: 'Solo', normalizedTitle: 'solo', canonicalGameId: solo._id, matchStatus: 'auto_matched', source: 'api' }]);
    const response = await (await authenticate('First User')).post('/api/v2/library-comparisons').send({ userIds: [second._id.toString()] }).expect(200);
    expect(response.body.users).toHaveLength(2); expect(response.body.games).toEqual([expect.objectContaining({ title: 'Shared', ownerIds: expect.arrayContaining([first._id.toString(), second._id.toString()]) })]);
  });

  test('returns only games owned by every selected comparison member', async () => {
    const first = await createMember('Intersection One'); const second = await createMember('Intersection Two'); const third = await createMember('Intersection Three');
    const all = await CanonicalGame.create({ canonicalTitle: 'All Three', normalizedTitle: 'all three' }); const partial = await CanonicalGame.create({ canonicalTitle: 'Only Two', normalizedTitle: 'only two' });
    await LibraryItem.create([{ userId: first._id, provider: 'steam', providerGameId: 'a1', providerTitle: 'All Three', normalizedTitle: 'all three', canonicalGameId: all._id, matchStatus: 'auto_matched', source: 'api' }, { userId: second._id, provider: 'steam', providerGameId: 'a2', providerTitle: 'All Three', normalizedTitle: 'all three', canonicalGameId: all._id, matchStatus: 'auto_matched', source: 'api' }, { userId: third._id, provider: 'steam', providerGameId: 'a3', providerTitle: 'All Three', normalizedTitle: 'all three', canonicalGameId: all._id, matchStatus: 'auto_matched', source: 'api' }, { userId: first._id, provider: 'gog', providerGameId: 'p1', providerTitle: 'Only Two', normalizedTitle: 'only two', canonicalGameId: partial._id, matchStatus: 'auto_matched', source: 'api' }, { userId: second._id, provider: 'gog', providerGameId: 'p2', providerTitle: 'Only Two', normalizedTitle: 'only two', canonicalGameId: partial._id, matchStatus: 'auto_matched', source: 'api' }]);
    const response = await (await authenticate('Intersection One')).post('/api/v2/library-comparisons').send({ userIds: [second._id.toString(), third._id.toString()] }).expect(200);
    expect(response.body.games).toEqual([expect.objectContaining({ title: 'All Three' })]);
  });
});