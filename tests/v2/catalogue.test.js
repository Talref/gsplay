const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const User = require('../../src/v2/models/User');
const CanonicalGame = require('../../src/v2/models/CanonicalGame');
const LibraryItem = require('../../src/v2/models/LibraryItem');
const GameAlias = require('../../src/v2/models/GameAlias');

const config = loadEnvironment({ NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test', JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32) });
const app = createApp(config); const password = 'correct-horse-battery-staple';
async function createUser(username, role = 'member') { return User.create({ usernameNormalized: User.normalizeUsername(username), usernameDisplay: username, role, passwordHash: await User.hashPassword(password) }); }
async function login(username) { const agent = request.agent(app); await agent.post('/api/v2/auth/login').send({ username, password }).expect(200); return agent; }

describe('v2 catalogue and administrative APIs', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());
  test('serves canonical games, filters, and owners', async () => {
    const user = await createUser('Catalogue User'); const game = await CanonicalGame.create({ canonicalTitle: 'Aqua Quest', normalizedTitle: 'aqua quest', genres: ['Adventure'], platforms: ['PC'] });
    await LibraryItem.create({ userId: user._id, provider: 'steam', providerGameId: '1', providerTitle: 'Aqua Quest', normalizedTitle: 'aqua quest', canonicalGameId: game._id, matchStatus: 'auto_matched', source: 'api' });
    const agent = await login('Catalogue User');
    expect((await agent.get('/api/v2/games?genre=Adventure').expect(200)).body.games).toEqual([expect.objectContaining({ title: 'Aqua Quest' })]);
    expect((await agent.get(`/api/v2/games/${game._id}/owners`).expect(200)).body.owners).toEqual([{ id: user._id.toString(), username: 'Catalogue User' }]);
    expect((await agent.get('/api/v2/game-filters').expect(200)).body).toEqual({ genres: ['Adventure'], platforms: ['PC'] });
  });
  test('enforces admin role for job and match review routes', async () => {
    await createUser('Member'); const admin = await createUser('Admin User', 'admin');
    await (await login('Member')).get('/api/v2/admin/jobs').expect(403);
    expect((await (await login('Admin User')).get('/api/v2/admin/jobs').expect(200)).body.jobs).toEqual([]);
    expect(admin.role).toBe('admin');
  });
  test('returns public community top games and admin enrichment status', async () => {
    const first = await createUser('First'); const second = await createUser('Second'); await createUser('Operations Admin', 'admin');
    const game = await CanonicalGame.create({ canonicalTitle: 'Popular Game', normalizedTitle: 'popular game', metadata: { status: 'complete' } });
    await CanonicalGame.create({ canonicalTitle: 'Waiting Game', normalizedTitle: 'waiting game', metadata: { status: 'pending' } });
    await LibraryItem.create([{ userId: first._id, provider: 'steam', providerGameId: '1', providerTitle: 'Popular Game', normalizedTitle: 'popular game', canonicalGameId: game._id, matchStatus: 'auto_matched', source: 'api' }, { userId: first._id, provider: 'gog', providerGameId: '2', providerTitle: 'Popular Game', normalizedTitle: 'popular game', canonicalGameId: game._id, matchStatus: 'auto_matched', source: 'api' }, { userId: second._id, provider: 'epic', providerGameId: '3', providerTitle: 'Popular Game', normalizedTitle: 'popular game', canonicalGameId: game._id, matchStatus: 'auto_matched', source: 'api' }]);
    const top = await request(app).get('/api/v2/community/games/top').expect(200);
    expect(top.body.games).toEqual([expect.objectContaining({ title: 'Popular Game', ownerCount: 2, owners: expect.arrayContaining([expect.objectContaining({ username: 'First', providers: expect.arrayContaining(['steam', 'gog']) })]) })]);
    const admin = await login('Operations Admin'); const status = await admin.get('/api/v2/admin/enrichment-status').expect(200);
    expect(status.body.metadata).toMatchObject({ total: 2, complete: 1, pending: 1, enrichedPercent: 50 });
    await admin.post('/api/v2/admin/enrichment-repair').expect(202);
  });
  test('lets an admin resolve ambiguous matches and persists a reusable alias', async () => {
    const member = await createUser('Match Member'); await createUser('Match Admin', 'admin');
    const game = await CanonicalGame.create({ canonicalTitle: 'Aqua Quest', normalizedTitle: 'aqua quest' });
    const item = await LibraryItem.create({ userId: member._id, provider: 'gog', providerGameId: 'gog-1', providerTitle: 'Aqua Quest', normalizedTitle: 'aqua quest', matchStatus: 'ambiguous', source: 'upload' });
    const admin = await login('Match Admin');
    expect((await admin.get('/api/v2/admin/matches/review').expect(200)).body.matches).toEqual([expect.objectContaining({ id: item._id.toString() })]);
    await admin.put(`/api/v2/admin/matches/${item._id}`).send({ canonicalGameId: game._id.toString() }).expect(200);
    expect(await GameAlias.findOne({ provider: 'gog', providerGameId: 'gog-1', canonicalGameId: game._id, matchType: 'manual' })).toBeTruthy();
  });
});