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

  test('returns only the authenticated user active library, grouped by canonical game and provider set', async () => {
    const member = await createMember('Library User'); const other = await createMember('Other User');
    const game = await CanonicalGame.create({ canonicalTitle: 'Shared Game', normalizedTitle: 'shared game' });
    await LibraryItem.create([{ userId: member._id, provider: 'steam', providerGameId: '1', providerTitle: 'Shared Game', normalizedTitle: 'shared game', canonicalGameId: game._id, matchStatus: 'auto_matched', source: 'api' }, { userId: member._id, provider: 'gog', providerGameId: '2', providerTitle: 'Shared Game', normalizedTitle: 'shared game', canonicalGameId: game._id, matchStatus: 'auto_matched', source: 'api' }, { userId: other._id, provider: 'steam', providerGameId: '1', providerTitle: 'Shared Game', normalizedTitle: 'shared game', canonicalGameId: game._id, matchStatus: 'auto_matched', source: 'api' }, { userId: member._id, provider: 'gog', providerGameId: 'gone', providerTitle: 'Removed', normalizedTitle: 'removed', source: 'api', removedAt: new Date() }]);
    const response = await (await authenticate('Library User')).get('/api/v2/me/library').expect(200);
    expect(response.body.page.total).toBe(1);
    expect(response.body.items[0]).toMatchObject({ providerTitle: 'Shared Game', canonicalGame: { title: 'Shared Game' }, providers: expect.arrayContaining(['steam', 'gog']), entitlementCount: 2 });
  });

  test('lets a user add, remove, and restore a manual catalogue entitlement without touching imported ownership', async () => {
    const user = await createMember('Manual Owner'); const agent = await authenticate('Manual Owner');
    const game = await CanonicalGame.create({ canonicalTitle: 'Manual Quest', normalizedTitle: 'manualquest' });
    await agent.put(`/api/v2/me/library/games/${game._id}`).expect(201).expect(({ body }) => expect(body).toMatchObject({ created: true, ownership: { owned: true, manual: true, providers: ['manual'] } }));
    expect(await LibraryItem.countDocuments({ userId: user._id, provider: 'manual', removedAt: null })).toBe(1);
    await agent.put(`/api/v2/me/library/games/${game._id}`).expect(200).expect(({ body }) => expect(body.created).toBe(false));
    await agent.delete(`/api/v2/me/library/games/${game._id}`).send({}).expect(400);
    await agent.delete(`/api/v2/me/library/games/${game._id}`).send({ confirmation: 'REMOVE FROM LIBRARY' }).expect(200).expect(({ body }) => expect(body.ownership.owned).toBe(false));
    expect(await LibraryItem.findOne({ userId: user._id, provider: 'manual', providerGameId: game._id.toString(), removedAt: { $ne: null } })).toBeTruthy();
    await agent.put(`/api/v2/me/library/games/${game._id}`).expect(200).expect(({ body }) => expect(body).toMatchObject({ created: false, ownership: { manual: true } }));
    await LibraryItem.create({ userId: user._id, provider: 'steam', providerGameId: '123', providerTitle: game.canonicalTitle, normalizedTitle: game.normalizedTitle, canonicalGameId: game._id, matchStatus: 'auto_matched', source: 'api' });
    await agent.delete(`/api/v2/me/library/games/${game._id}`).send({ confirmation: 'REMOVE FROM LIBRARY' }).expect(200).expect(({ body }) => expect(body.ownership).toMatchObject({ owned: true, providers: ['steam'] }));
    await agent.delete(`/api/v2/me/library/games/${game._id}`).send({ confirmation: 'REMOVE FROM LIBRARY' }).expect(409);
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

  test('offers public comparison choices without exposing roles', async () => {
    const caller = await createMember('Comparison Caller'); const other = await createMember('Comparison Other');
    const response = await request(app).get('/api/v2/users').expect(200);
    expect(response.body.users.map((user) => user.id)).toEqual(expect.arrayContaining([caller._id.toString(), other._id.toString()]));
    expect(response.body.users[0]).not.toHaveProperty('role');
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

  test('returns one selected member library publicly without including an authenticated caller', async () => {
    const caller = await createMember('Logged In Caller'); const selected = await createMember('Selected Library');
    const callerOnly = await CanonicalGame.create({ canonicalTitle: 'Caller Only', normalizedTitle: 'caller only' }); const selectedOnly = await CanonicalGame.create({ canonicalTitle: 'Selected Only', normalizedTitle: 'selected only' });
    await LibraryItem.create([{ userId: caller._id, provider: 'steam', providerGameId: 'caller', providerTitle: 'Caller Only', normalizedTitle: 'caller only', canonicalGameId: callerOnly._id, matchStatus: 'auto_matched', source: 'api' }, { userId: selected._id, provider: 'steam', providerGameId: 'selected', providerTitle: 'Selected Only', normalizedTitle: 'selected only', canonicalGameId: selectedOnly._id, matchStatus: 'auto_matched', source: 'api' }]);
    const response = await (await authenticate('Logged In Caller')).post('/api/v2/library-comparisons').send({ userIds: [selected._id.toString()] }).expect(200);
    expect(response.body.users).toEqual([expect.objectContaining({ id: selected._id.toString(), username: 'Selected Library' })]);
    expect(response.body.games).toEqual([expect.objectContaining({ title: 'Selected Only', ownerIds: [selected._id.toString()] })]);
  });

  test('compares canonical ownership server-side for exactly the selected members', async () => {
    const first = await createMember('First User'); const second = await createMember('Second User'); const third = await createMember('Third User');
    const shared = await CanonicalGame.create({ canonicalTitle: 'Shared', normalizedTitle: 'shared' }); const solo = await CanonicalGame.create({ canonicalTitle: 'Solo', normalizedTitle: 'solo' });
    await LibraryItem.create([{ userId: first._id, provider: 'steam', providerGameId: '1', providerTitle: 'Shared', normalizedTitle: 'shared', canonicalGameId: shared._id, matchStatus: 'auto_matched', source: 'api' }, { userId: second._id, provider: 'steam', providerGameId: '2', providerTitle: 'Shared', normalizedTitle: 'shared', canonicalGameId: shared._id, matchStatus: 'auto_matched', source: 'api' }, { userId: third._id, provider: 'steam', providerGameId: '3', providerTitle: 'Solo', normalizedTitle: 'solo', canonicalGameId: solo._id, matchStatus: 'auto_matched', source: 'api' }]);
    const response = await request(app).post('/api/v2/library-comparisons').send({ userIds: [first._id.toString(), second._id.toString()] }).expect(200);
    expect(response.body.users).toHaveLength(2); expect(response.body.games).toEqual([expect.objectContaining({ title: 'Shared', ownerIds: expect.arrayContaining([first._id.toString(), second._id.toString()]) })]);
  });

  test('returns only games owned by every selected comparison member', async () => {
    const first = await createMember('Intersection One'); const second = await createMember('Intersection Two'); const third = await createMember('Intersection Three');
    const all = await CanonicalGame.create({ canonicalTitle: 'All Three', normalizedTitle: 'all three' }); const partial = await CanonicalGame.create({ canonicalTitle: 'Only Two', normalizedTitle: 'only two' });
    await LibraryItem.create([{ userId: first._id, provider: 'steam', providerGameId: 'a1', providerTitle: 'All Three', normalizedTitle: 'all three', canonicalGameId: all._id, matchStatus: 'auto_matched', source: 'api' }, { userId: second._id, provider: 'steam', providerGameId: 'a2', providerTitle: 'All Three', normalizedTitle: 'all three', canonicalGameId: all._id, matchStatus: 'auto_matched', source: 'api' }, { userId: third._id, provider: 'steam', providerGameId: 'a3', providerTitle: 'All Three', normalizedTitle: 'all three', canonicalGameId: all._id, matchStatus: 'auto_matched', source: 'api' }, { userId: first._id, provider: 'gog', providerGameId: 'p1', providerTitle: 'Only Two', normalizedTitle: 'only two', canonicalGameId: partial._id, matchStatus: 'auto_matched', source: 'api' }, { userId: second._id, provider: 'gog', providerGameId: 'p2', providerTitle: 'Only Two', normalizedTitle: 'only two', canonicalGameId: partial._id, matchStatus: 'auto_matched', source: 'api' }]);
    const response = await request(app).post('/api/v2/library-comparisons').send({ userIds: [second._id.toString(), third._id.toString()] }).expect(200);
    expect(response.body.games).toEqual([expect.objectContaining({ title: 'All Three' })]);
  });
});