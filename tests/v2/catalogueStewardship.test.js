const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const User = require('../../src/v2/models/User');
const CanonicalGame = require('../../src/v2/models/CanonicalGame');
const CanonicalGameMerge = require('../../src/v2/models/CanonicalGameMerge');
const LibraryItem = require('../../src/v2/models/LibraryItem');
const GameAlias = require('../../src/v2/models/GameAlias');

const config = loadEnvironment({ NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test', JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32) });
const igdbClient = { searchTitle: jest.fn(), getGameById: jest.fn(), getGameBySlug: jest.fn() };
const app = createApp(config, { igdbClient });
const password = 'correct-horse-battery-staple';
async function login() { const admin = await User.create({ usernameNormalized: 'steward', usernameDisplay: 'Steward', role: 'admin', passwordHash: await User.hashPassword(password) }); const agent = request.agent(app); await agent.post('/api/v2/auth/login').send({ username: admin.usernameDisplay, password }).expect(200); return { agent, admin }; }

describe('v2 catalogue stewardship', () => {
  beforeEach(async () => { await global.testUtils.cleanupDatabase(); jest.clearAllMocks(); });

  test('creates independent manual entries without fabricating an entitlement', async () => {
    const { agent } = await login();
    const response = await agent.post('/api/v2/admin/games').send({ title: 'Vintage Story' }).expect(201);
    expect(response.body.game).toMatchObject({ title: 'Vintage Story', origin: 'manual_catalogue', storeAvailability: 'independent', metadataStatus: 'pending' });
    expect(await LibraryItem.countDocuments()).toBe(0);
  });

  test('imports a complete independent catalogue entry from a strict IGDB URL without duplicates', async () => {
    const { agent } = await login();
    igdbClient.getGameBySlug = jest.fn().mockResolvedValue({ igdbId: 77, canonicalTitle: 'Vintage Story', normalizedTitle: 'vintage story', summary: 'A sandbox game', genres: ['Simulator'], platforms: ['PC'], igdbUrl: 'https://www.igdb.com/games/vintage-story' });
    const created = await agent.post('/api/v2/admin/games/from-igdb-url').send({ url: 'https://www.igdb.com/games/vintage-story' }).expect(201);
    expect(created.body).toMatchObject({ created: true, game: { title: 'Vintage Story', igdbId: 77, summary: 'A sandbox game', metadataStatus: 'complete' } });
    const repeated = await agent.post('/api/v2/admin/games/from-igdb-url').send({ url: 'https://www.igdb.com/games/vintage-story' }).expect(200);
    expect(repeated.body.created).toBe(false);
    await agent.post('/api/v2/admin/games/from-igdb-url').send({ url: 'https://evil.example/games/vintage-story' }).expect(400);
  });

  test('updates rich manual metadata and archives only unreferenced records', async () => {
    const { agent, admin } = await login();
    const game = await CanonicalGame.create({ canonicalTitle: 'Typo', normalizedTitle: 'typo' });
    const updated = await agent.put(`/api/v2/admin/games/${game._id}`).send({ title: 'Corrected', summary: 'Curated', artwork: 'https://images.example/cover.jpg', genres: ['Adventure'], platforms: ['PC'], releaseDate: '2020-01-01' }).expect(200);
    expect(updated.body.game).toMatchObject({ title: 'Corrected', summary: 'Curated', genres: ['Adventure'], platforms: ['PC'] });
    await agent.delete(`/api/v2/admin/games/${game._id}`).send({ reason: 'Duplicate scratch record' }).expect(200);
    expect(await CanonicalGame.findById(game._id)).toMatchObject({ archivedAt: expect.any(Date) });
    const referenced = await CanonicalGame.create({ canonicalTitle: 'Referenced', normalizedTitle: 'referenced' });
    await LibraryItem.create({ userId: admin._id, provider: 'steam', providerGameId: 'archive-test', providerTitle: 'Referenced', normalizedTitle: 'referenced', canonicalGameId: referenced._id, matchStatus: 'auto_matched', source: 'api' });
    await agent.delete(`/api/v2/admin/games/${referenced._id}`).send({}).expect(409);
  });

  test('uses only verified IGDB metadata and offers an existing canonical record for merge', async () => {
    const { agent } = await login();
    const old = await CanonicalGame.create({ canonicalTitle: 'Batman Arkam Asykum GOTY Edition', normalizedTitle: 'batmanarkamasylumgotyedition', metadata: { status: 'failed' } });
    const real = await CanonicalGame.create({ canonicalTitle: 'Batman: Arkham Asylum - Game of the Year Edition', normalizedTitle: 'batmanarkhamasylumgameoftheyearedition', igdbId: 42, metadata: { status: 'complete' } });
    igdbClient.getGameById.mockResolvedValue({ igdbId: 42, canonicalTitle: real.canonicalTitle, normalizedTitle: real.normalizedTitle, platforms: ['PC'], igdbUrl: 'https://www.igdb.com/games/batman-arkham-asylum-game-of-the-year-edition' });
    const conflict = await agent.put(`/api/v2/admin/games/${old._id}/igdb`).send({ igdbId: 42 }).expect(409);
    expect(conflict.body.error.details).toMatchObject({ gameId: real._id.toString(), title: real.canonicalTitle });
  });

  test('attaches verified IGDB metadata from a strict URL to an existing game without changing ownership', async () => {
    const { agent, admin } = await login();
    const game = await CanonicalGame.create({ canonicalTitle: 'Control?', normalizedTitle: 'control', metadata: { status: 'failed' } });
    await LibraryItem.create({ userId: admin._id, provider: 'steam', providerGameId: 'control', providerTitle: 'Control?', normalizedTitle: 'control', canonicalGameId: game._id, matchStatus: 'auto_matched', source: 'api' });
    igdbClient.getGameBySlug.mockResolvedValue({ igdbId: 2019, canonicalTitle: 'Control', normalizedTitle: 'control', summary: 'Paranormal action', genres: ['Adventure'], platforms: ['PC'], igdbUrl: 'https://www.igdb.com/games/control' });
    const response = await agent.put(`/api/v2/admin/games/${game._id}/igdb-url`).send({ url: 'https://www.igdb.com/games/control' }).expect(200);
    expect(response.body.game).toMatchObject({ title: 'Control', igdbId: 2019, metadataStatus: 'complete', summary: 'Paranormal action' });
    expect(await LibraryItem.findOne({ providerGameId: 'control' })).toMatchObject({ canonicalGameId: game._id });
    await agent.put(`/api/v2/admin/games/${game._id}/igdb-url`).send({ url: 'https://evil.example/games/control' }).expect(400);
  });

  test('returns a merge-safe conflict when an IGDB URL belongs to another game', async () => {
    const { agent } = await login();
    const existing = await CanonicalGame.create({ canonicalTitle: 'Control: Ultimate Edition', normalizedTitle: 'controlultimateedition', igdbId: 2020 });
    const selected = await CanonicalGame.create({ canonicalTitle: 'Control', normalizedTitle: 'control' });
    igdbClient.getGameBySlug.mockResolvedValue({ igdbId: 2020, canonicalTitle: existing.canonicalTitle, normalizedTitle: existing.normalizedTitle, igdbUrl: 'https://www.igdb.com/games/control-ultimate-edition' });
    const response = await agent.put(`/api/v2/admin/games/${selected._id}/igdb-url`).send({ url: 'https://www.igdb.com/games/control-ultimate-edition' }).expect(409);
    expect(response.body.error.details).toMatchObject({ gameId: existing._id.toString(), title: existing.canonicalTitle });
  });

  test('reviews every visible failed game in pages, caps suggestions, and resolves manually', async () => {
    const { agent, admin } = await login();
    const failed = await CanonicalGame.create({ canonicalTitle: 'Failed no candidates', normalizedTitle: 'failednocandidates', metadata: { status: 'failed', lastError: 'No match' } });
    const crowded = await CanonicalGame.create({ canonicalTitle: 'Crowded', normalizedTitle: 'crowded', metadata: { status: 'failed' }, metadataCandidates: [1, 2, 3, 4].map((igdbId) => ({ igdbId, title: `Candidate ${igdbId}` })) });
    await CanonicalGame.create({ canonicalTitle: 'Hidden demo', normalizedTitle: 'hiddendemo', hiddenAt: new Date(), metadata: { status: 'failed' } });
    const first = await agent.get('/api/v2/admin/metadata-reviews?page=1&pageSize=1').expect(200);
    expect(first.body.page).toMatchObject({ number: 1, size: 1, total: 2 });
    const all = await agent.get('/api/v2/admin/metadata-reviews?page=1&pageSize=30').expect(200);
    expect(all.body.reviews.map((review) => review.game.title)).toEqual(expect.arrayContaining(['Failed no candidates', 'Crowded']));
    expect(all.body.reviews.find((review) => review.game.id === crowded._id.toString()).candidates).toHaveLength(3);
    const resolved = await agent.put(`/api/v2/admin/games/${failed._id}/manual-metadata`).send({ title: 'Curated title', summary: 'Curated summary', genres: ['Adventure'], platforms: ['PC'] }).expect(200);
    expect(resolved.body.game).toMatchObject({ title: 'Curated title', metadataStatus: 'complete' });
    expect((await CanonicalGame.findById(failed._id)).metadataReviewedBy).toEqual(admin._id);
  });

  test('hides a referenced failed game from member reads and supports admin unhide', async () => {
    const { agent, admin } = await login();
    const game = await CanonicalGame.create({ canonicalTitle: 'Dedicated Server', normalizedTitle: 'dedicatedserver', metadata: { status: 'failed' } });
    await LibraryItem.create({ userId: admin._id, provider: 'steam', providerGameId: 'server', providerTitle: 'Dedicated Server', normalizedTitle: 'dedicatedserver', canonicalGameId: game._id, matchStatus: 'auto_matched', source: 'api' });
    await agent.put(`/api/v2/admin/games/${game._id}/visibility`).send({ hidden: true }).expect(200);
    expect(await LibraryItem.countDocuments({ canonicalGameId: game._id })).toBe(1);
    expect((await agent.get('/api/v2/games?q=Dedicated').expect(200)).body.games).toHaveLength(0);
    expect((await agent.get('/api/v2/me/library').expect(200)).body.items).toHaveLength(0);
    expect((await agent.get('/api/v2/admin/metadata-reviews').expect(200)).body.reviews).toHaveLength(0);
    expect((await agent.get('/api/v2/admin/games?q=Dedicated').expect(200)).body.games[0]).toMatchObject({ id: game._id.toString(), hidden: true });
    await agent.put(`/api/v2/admin/games/${game._id}/visibility`).send({ hidden: false }).expect(200);
    expect((await agent.get('/api/v2/games?q=Dedicated').expect(200)).body.games).toHaveLength(1);
  });

  test('merges entitlement and alias references, retains the spelling, and writes an audit record', async () => {
    const { agent, admin } = await login();
    const source = await CanonicalGame.create({ canonicalTitle: 'Bad Batman', normalizedTitle: 'badbatman' });
    const target = await CanonicalGame.create({ canonicalTitle: 'Good Batman', normalizedTitle: 'goodbatman' });
    await LibraryItem.create({ userId: admin._id, provider: 'steam', providerGameId: '99', providerTitle: 'Bad Batman', normalizedTitle: 'badbatman', canonicalGameId: source._id, matchStatus: 'auto_matched', source: 'api' });
    await GameAlias.create({ provider: 'steam', providerGameId: '99', normalizedProviderTitle: 'badbatman', canonicalGameId: source._id, matchType: 'manual', confidence: 1 });
    await agent.post(`/api/v2/admin/games/${source._id}/merge`).send({ targetGameId: target._id.toString(), reason: 'Same game' }).expect(200);
    expect(await LibraryItem.findOne({ providerGameId: '99' })).toMatchObject({ canonicalGameId: target._id });
    expect(await GameAlias.findOne({ providerGameId: '99' })).toMatchObject({ canonicalGameId: target._id });
    expect((await CanonicalGame.findById(target._id)).alternativeTitles).toContain('Bad Batman');
    expect(await CanonicalGameMerge.findOne({ sourceGameId: source._id, targetGameId: target._id })).toBeTruthy();
  });

  test('requires typed confirmation and resets every failed game, including manual catalogue games', async () => {
    const { agent } = await login();
    await CanonicalGame.create([{ canonicalTitle: 'Miss One', normalizedTitle: 'missone', metadata: { status: 'failed' } }, { canonicalTitle: 'Miss Two', normalizedTitle: 'misstwo', metadata: { status: 'failed' } }, { canonicalTitle: 'Vintage', normalizedTitle: 'vintage', origin: 'manual_catalogue', metadata: { status: 'failed' } }]);
    await agent.post('/api/v2/admin/enrichment-reset').send({ confirmation: 'NOPE' }).expect(400);
    const response = await agent.post('/api/v2/admin/enrichment-reset').send({ confirmation: 'RESET IGDB' }).expect(200);
    expect(response.body.reset).toBe(3);
    expect(await CanonicalGame.countDocuments({ 'metadata.status': 'pending' })).toBe(3);
  });
});