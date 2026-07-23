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
    const user = await createUser('Catalogue User'); const game = await CanonicalGame.create({ canonicalTitle: 'Aqua Quest', normalizedTitle: 'aqua quest', genres: ['Adventure'], platforms: ['PC'], videos: ['dQw4w9WgXcQ', 'not a video'], companies: ['Aqua Studio'] });
    await LibraryItem.create({ userId: user._id, provider: 'steam', providerGameId: '1', providerTitle: 'Aqua Quest', normalizedTitle: 'aqua quest', canonicalGameId: game._id, matchStatus: 'auto_matched', source: 'api' });
    const agent = await login('Catalogue User');
    expect((await agent.get('/api/v2/games?genre=Adventure').expect(200)).body.games).toEqual([expect.objectContaining({ title: 'Aqua Quest' })]);
    expect((await agent.get(`/api/v2/games/${game._id}`).expect(200)).body.game).toMatchObject({ id: game._id.toString(), ownerCount: 1, companies: ['Aqua Studio'], videos: [{ id: 'dQw4w9WgXcQ', embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', watchUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }] });
    expect((await agent.get(`/api/v2/games/${game._id}/owners`).expect(200)).body.owners).toEqual([{ id: user._id.toString(), username: 'Catalogue User', providers: ['steam'] }]);
    expect((await agent.get('/api/v2/game-filters').expect(200)).body).toEqual({ genres: ['Adventure'], platforms: ['PC'], gameModes: [] });
  });
  test('counts active legacy entitlements whose removedAt field was never persisted', async () => {
    const user = await createUser('Legacy Owner'); const game = await CanonicalGame.create({ canonicalTitle: 'Legacy Aqua', normalizedTitle: 'legacy aqua' });
    const item = await LibraryItem.create({ userId: user._id, provider: 'steam', providerGameId: 'legacy-aqua', providerTitle: 'Legacy Aqua', normalizedTitle: 'legacy aqua', canonicalGameId: game._id, matchStatus: 'auto_matched', source: 'api' });
    await LibraryItem.collection.updateOne({ _id: item._id }, { $unset: { removedAt: '' } });
    const agent = await login(user.usernameDisplay);
    expect((await agent.get(`/api/v2/games/${game._id}`).expect(200)).body.game.ownerCount).toBe(1);
    expect((await agent.get('/api/v2/games?sort=owners').expect(200)).body.games).toEqual([expect.objectContaining({ id: game._id.toString(), ownerCount: 1 })]);
  });
  test('permits only the trusted YouTube embed origins in the API CSP', async () => {
    const response = await request(app).get('/health/live').expect(200);
    expect(response.headers['content-security-policy']).toContain('frame-src \'self\' https://www.youtube.com https://www.youtube-nocookie.com');
  });
  test('searches the full active catalogue server-side rather than only a client page', async () => {
    const agent = await login((await createUser('Search User')).usernameDisplay);
    await CanonicalGame.create(Array.from({ length: 105 }, (_, index) => ({ canonicalTitle: `Common Game ${index}`, normalizedTitle: `common game ${index}` })));
    const needle = await CanonicalGame.create({ canonicalTitle: 'Needle Beyond First Page', normalizedTitle: 'needle beyond first page' });
    const response = await agent.get('/api/v2/games?q=Needle&page=1&pageSize=12').expect(200);
    expect(response.body).toMatchObject({ page: { total: 1, size: 12 }, games: [expect.objectContaining({ id: needle._id.toString(), title: 'Needle Beyond First Page' })] });
  });
  test('returns filter facets and sorts visible games by rating, name, or distinct owners', async () => {
    const first = await createUser('First owner'); const second = await createUser('Second owner'); const agent = await login(first.usernameDisplay);
    const alpha = await CanonicalGame.create({ canonicalTitle: 'Alpha Hero', normalizedTitle: 'alpha hero', genres: ['Action'], platforms: ['PC'], gameModes: ['Single player'], rating: 72 });
    const bravo = await CanonicalGame.create({ canonicalTitle: 'Bravo Quest', normalizedTitle: 'bravo quest', genres: ['Adventure'], platforms: ['PC'], gameModes: ['Co-operative'], rating: 92 });
    await CanonicalGame.create({ canonicalTitle: 'Hidden Hero', normalizedTitle: 'hidden hero', genres: ['Action'], platforms: ['PC'], gameModes: ['Single player'], rating: 100, hiddenAt: new Date() });
    await LibraryItem.create([{ userId: first._id, provider: 'steam', providerGameId: 'alpha-steam', providerTitle: 'Alpha Hero', normalizedTitle: 'alpha hero', canonicalGameId: alpha._id, matchStatus: 'auto_matched', source: 'api' }, { userId: first._id, provider: 'gog', providerGameId: 'alpha-gog', providerTitle: 'Alpha Hero', normalizedTitle: 'alpha hero', canonicalGameId: alpha._id, matchStatus: 'auto_matched', source: 'api' }, { userId: second._id, provider: 'epic', providerGameId: 'alpha-epic', providerTitle: 'Alpha Hero', normalizedTitle: 'alpha hero', canonicalGameId: alpha._id, matchStatus: 'auto_matched', source: 'api' }, { userId: first._id, provider: 'steam', providerGameId: 'bravo', providerTitle: 'Bravo Quest', normalizedTitle: 'bravo quest', canonicalGameId: bravo._id, matchStatus: 'auto_matched', source: 'api' }]);
    const rated = await agent.get('/api/v2/games?sort=rating').expect(200);
    expect(rated.body.games.map((game) => game.title)).toEqual(['Bravo Quest', 'Alpha Hero']);
    expect(rated.body.games.find((game) => game.id === alpha._id.toString()).ownerCount).toBe(2);
    expect((await agent.get('/api/v2/games?sort=name').expect(200)).body.games.map((game) => game.title)).toEqual(['Alpha Hero', 'Bravo Quest']);
    expect((await agent.get('/api/v2/games?sort=owners').expect(200)).body.games.map((game) => game.title)).toEqual(['Alpha Hero', 'Bravo Quest']);
    expect((await agent.get('/api/v2/games?genre=Action&platform=PC&gameMode=Single%20player').expect(200)).body.games.map((game) => game.title)).toEqual(['Alpha Hero']);
    expect((await agent.get('/api/v2/game-filters').expect(200)).body).toEqual({ genres: ['Action', 'Adventure'], platforms: ['PC'], gameModes: ['Co-operative', 'Single player'] });
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
  test('resets every failed enrichment to pending while preserving complete games', async () => {
    await createUser('Reset Admin', 'admin');
    const failed = await CanonicalGame.create({ canonicalTitle: 'Failed Game', normalizedTitle: 'failed game', metadata: { status: 'failed', lastError: 'No verified IGDB match' } });
    const complete = await CanonicalGame.create({ canonicalTitle: 'Complete Game', normalizedTitle: 'complete game', metadata: { status: 'complete' } });
    const agent = await login('Reset Admin');
    await agent.post('/api/v2/admin/enrichment-reset').send({ confirmation: 'wrong' }).expect(400);
    const reset = await agent.post('/api/v2/admin/enrichment-reset').send({ confirmation: 'RESET IGDB' }).expect(200);
    expect(reset.body).toMatchObject({ matched: 1, reset: 1 });
    expect(await CanonicalGame.findById(failed._id)).toMatchObject({ metadata: expect.objectContaining({ status: 'pending', attempts: 0 }) });
    expect(await CanonicalGame.findById(complete._id)).toMatchObject({ metadata: expect.objectContaining({ status: 'complete' }) });
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