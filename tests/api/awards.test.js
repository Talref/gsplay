const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../src/api/app');
const { loadEnvironment } = require('../../src/core/config/environment');
const { zonedParts } = require('../../src/core/time/communityTime');
const Edition = require('../../src/core/models/AwardsEdition');
const User = require('../../src/core/models/User');
const Game = require('../../src/core/models/CanonicalGame');

const config = loadEnvironment({
  NODE_ENV: 'test',
  MONGO_URI: 'mongodb://127.0.0.1/test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32)
});
const game = (igdbId) => ({
  igdbId,
  canonicalTitle: `Game ${igdbId}`,
  igdbUrl: `https://www.igdb.com/games/game-${igdbId}`,
  platforms: ['Nintendo Switch'],
  artwork: 'https://images.igdb.com/cover.jpg',
  releaseDate: new Date('2001-01-01')
});
const igdb = {
  getGameById: jest.fn(async (value) => (value === 999 ? null : game(value))),
  getGameBySlug: jest.fn(async (slug) =>
    slug === 'missing' ? null : game(Number(slug.replace('game-', '')))
  ),
  searchGames: jest.fn(async () => [{ ...game(1), title: 'Game 1' }])
};
igdb.getGamesByIds = async (ids) =>
  (await Promise.all(ids.map((id) => igdb.getGameById(id)))).filter(Boolean);
igdb.getGamesBySlugs = async (slugs) =>
  new Map(await Promise.all(slugs.map(async (slug) => [slug, await igdb.getGameBySlug(slug)])));
const app = createApp(config, { igdbClient: igdb });
let admin, member, helper;
function client(user) {
  const token = jwt.sign({ sub: String(user._id), type: 'access' }, config.auth.accessSecret, {
    expiresIn: '1h'
  });
  return {
    get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
    post: (path) => request(app).post(path).set('Authorization', `Bearer ${token}`),
    put: (path) => request(app).put(path).set('Authorization', `Bearer ${token}`)
  };
}
const future = () => {
  const p = zonedParts(new Date(Date.now() + 86400000));
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}T${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
};
async function view() {
  return (await admin.get('/api/v2/admin/awards').expect(200)).body.edition;
}
async function action(name, extra = {}) {
  const edition = await view();
  return (
    await admin
      .post(`/api/v2/admin/awards/${name}`)
      .send({ version: edition.version, ...extra })
      .expect(200)
  ).body.edition;
}
async function prepareNominations() {
  await admin.post('/api/v2/admin/awards').send({}).expect(200);
  const edition = await view();
  await admin
    .put('/api/v2/admin/awards/categories')
    .send({
      version: edition.version,
      categories: [
        { name: 'Game of the year', description: 'Tell us!' },
        { name: 'Private servers' }
      ]
    })
    .expect(200);
  return action('start-nominations', { closesAt: future() });
}
async function prepareVoting() {
  await prepareNominations();
  await action('close-nominations');
  const edition = await view();
  await admin
    .put('/api/v2/admin/awards/categories')
    .send({
      version: edition.version,
      categories: [
        {
          name: 'Curated category',
          description: 'A different ballot',
          igdbUrls: [game(2).igdbUrl, game(3).igdbUrl]
        },
        { name: 'No votes fallback', igdbUrls: [game(4).igdbUrl] }
      ]
    })
    .expect(200);
  return action('start-voting', { closesAt: future() });
}
const selection = (category, igdbIds) => ({ categoryId: category.id, igdbIds });

beforeEach(async () => {
  await global.testUtils.cleanupDatabase();
  await Edition.init();
  jest.clearAllMocks();
  const users = await User.create(
    ['admin', 'member', 'helper'].map((role) => ({
      usernameNormalized: role,
      usernameDisplay: role,
      role,
      passwordHash: 'unused'
    }))
  );
  [admin, member, helper] = users.map(client);
});

test('requires GSPlay authentication and admin permissions, including helpers', async () => {
  for (const path of ['/awards', '/awards/games?q=game', '/admin/awards'])
    await request(app).get(`/api/v2${path}`).expect(401);
  for (const actor of [member, helper]) {
    await actor.get('/api/v2/admin/awards').expect(403);
    await actor.post('/api/v2/admin/awards').send({}).expect(403);
    await actor.put('/api/v2/admin/awards/categories').send({}).expect(403);
    await actor.put('/api/v2/admin/awards/winners').send({}).expect(403);
    for (const name of [
      'start-nominations',
      'close-nominations',
      'start-voting',
      'close-voting',
      'publish'
    ])
      await actor.post(`/api/v2/admin/awards/${name}`).send({}).expect(403);
  }
  expect((await member.get('/api/v2/awards').expect(200)).body).toEqual({ edition: null });
});

test('enforces phase order, required deadlines, version checks and immutable launched categories', async () => {
  await admin.post('/api/v2/admin/awards').send({}).expect(200);
  await admin.post('/api/v2/admin/awards').send({}).expect(409);
  let edition = await view();
  await admin
    .post('/api/v2/admin/awards/start-voting')
    .send({ version: edition.version, closesAt: future() })
    .expect(409);
  await admin
    .post('/api/v2/admin/awards/start-nominations')
    .send({ version: edition.version, closesAt: future() })
    .expect(400);
  await admin
    .put('/api/v2/admin/awards/categories')
    .send({ version: edition.version, categories: [{ name: 'Best game' }] })
    .expect(200);
  await admin
    .put('/api/v2/admin/awards/categories')
    .send({ version: edition.version, categories: [{ name: 'Stale' }] })
    .expect(409);
  edition = await view();
  for (const closesAt of [undefined, '2020-01-01T12:00', '2027-02-30T12:00', 'invalid'])
    await admin
      .post('/api/v2/admin/awards/start-nominations')
      .send({ version: edition.version, closesAt })
      .expect(400);
  edition = await action('start-nominations', { closesAt: future() });
  await admin
    .put('/api/v2/admin/awards/categories')
    .send({ version: edition.version, categories: [{ name: 'Changed' }] })
    .expect(409);
});

test('searches IGDB without ownership, platform or release-year filters and records one final nomination', async () => {
  const edition = await prepareNominations();
  expect(
    (await member.get('/api/v2/awards/games?q=Game').expect(200)).body.games[0].platforms
  ).toEqual(['Nintendo Switch']);
  await member.get('/api/v2/awards/games?q=Ga').expect(400);
  const payload = {
    editionId: edition.id,
    selections: [selection(edition.nominationCategories[0], [1, 2, 3, 4])]
  };
  const result = (await member.post('/api/v2/awards/nominations').send(payload).expect(200)).body
    .edition;
  expect(result.nominated).toBe(true);
  expect(result).not.toHaveProperty('nominations');
  expect(result).not.toHaveProperty('ballots');
  await member.post('/api/v2/awards/nominations').send(payload).expect(409);
  const managed = await view();
  expect(managed.nominations).toHaveLength(1);
  expect(managed.nominations[0]).toMatchObject({
    username: 'member',
    submittedAt: expect.any(String)
  });
  expect(managed.nominationCounts[0].games).toHaveLength(4);
  expect(managed.nominationCounts[1].games).toEqual([]);
  expect(await Game.countDocuments()).toBe(0);
  expect((await Edition.findById(edition.id)).year).toBe(zonedParts(new Date()).year);
});

test('validates all categories and selections and rejects empty, unknown, duplicate and forged submissions', async () => {
  const edition = await prepareNominations();
  const category = edition.nominationCategories[0];
  for (const selections of [
    [],
    [selection(category, [])],
    [selection(category, [1, 1])],
    [selection(category, [1, 2, 3, 4, 5])],
    [selection(category, [999])],
    [selection(category, ['1'])],
    [selection({ id: '012345678901234567890123' }, [1])],
    [selection(category, [1]), selection(category, [2])]
  ])
    await member
      .post('/api/v2/awards/nominations')
      .send({ editionId: edition.id, selections })
      .expect(400);
  await member
    .post('/api/v2/awards/nominations')
    .send({ editionId: edition.id, selections: [selection(category, [1])], userId: 'someone-else' })
    .expect(400);
  await member
    .post('/api/v2/awards/nominations')
    .send({ editionId: 'wrong', selections: [selection(category, [1])] })
    .expect(409);
  expect((await view()).nominations).toHaveLength(0);
});

test('accepts exactly one concurrent submission per account in each phase', async () => {
  let edition = await prepareNominations();
  const payload = {
    editionId: edition.id,
    selections: [selection(edition.nominationCategories[0], [1])]
  };
  const replies = await Promise.all(
    Array.from({ length: 8 }, () => member.post('/api/v2/awards/nominations').send(payload))
  );
  expect(replies.filter((reply) => reply.status === 200)).toHaveLength(1);
  expect(replies.filter((reply) => reply.status === 409)).toHaveLength(7);
  expect((await view()).nominations).toHaveLength(1);
  await action('close-nominations');
  edition = await view();
  await admin
    .put('/api/v2/admin/awards/categories')
    .send({
      version: edition.version,
      categories: [{ name: 'Voting', igdbUrls: [game(1).igdbUrl] }]
    })
    .expect(200);
  edition = await action('start-voting', { closesAt: future() });
  const ballots = await Promise.all(
    Array.from({ length: 8 }, () =>
      member
        .post('/api/v2/awards/ballots')
        .send({ editionId: edition.id, selections: [selection(edition.votingCategories[0], [1])] })
    )
  );
  expect(ballots.filter((reply) => reply.status === 200)).toHaveLength(1);
  expect(ballots.filter((reply) => reply.status === 409)).toHaveLength(7);
  expect((await view()).ballots).toHaveLength(1);
});

test('deadline expiry closes phases without opening the next active phase', async () => {
  const edition = await prepareNominations();
  await Edition.updateOne(
    { _id: edition.id },
    { $set: { nominationsCloseAt: new Date(Date.now() - 1) } }
  );
  await member
    .post('/api/v2/awards/nominations')
    .send({ editionId: edition.id, selections: [selection(edition.nominationCategories[0], [1])] })
    .expect(409);
  expect((await member.get('/api/v2/awards').expect(200)).body.edition).toMatchObject({
    status: 'review',
    categories: []
  });
  await member.get('/api/v2/awards/games?q=Game').expect(409);
});

test('checks deadline and phase again after provider lookup, so in-flight nominations cannot enter a closed phase', async () => {
  const edition = await prepareNominations();
  igdb.getGameById.mockImplementationOnce(async () => {
    await Edition.updateOne(
      { _id: edition.id },
      { $set: { nominationsCloseAt: new Date(Date.now() - 1) } }
    );
    return game(1);
  });
  await member
    .post('/api/v2/awards/nominations')
    .send({ editionId: edition.id, selections: [selection(edition.nominationCategories[0], [1])] })
    .expect(409);
  expect((await view()).nominations).toHaveLength(0);
});

test('review can build an independent ballot and retain empty nomination categories and original raw selections', async () => {
  const edition = await prepareNominations();
  await member
    .post('/api/v2/awards/nominations')
    .send({ editionId: edition.id, selections: [selection(edition.nominationCategories[0], [1])] })
    .expect(200);
  await action('close-nominations');
  let review = await view();
  await admin
    .put('/api/v2/admin/awards/categories')
    .send({
      version: review.version,
      categories: [{ name: 'Empty while preparing', igdbUrls: [] }]
    })
    .expect(200);
  review = await view();
  await admin
    .post('/api/v2/admin/awards/start-voting')
    .send({ version: review.version, closesAt: future() })
    .expect(400);
  for (const igdbUrls of [
    ['https://example.com/game'],
    [game(1).igdbUrl, game(1).igdbUrl],
    ['https://www.igdb.com/games/missing']
  ])
    await admin
      .put('/api/v2/admin/awards/categories')
      .send({ version: review.version, categories: [{ name: 'Curated', igdbUrls }] })
      .expect(400);
  await admin
    .put('/api/v2/admin/awards/categories')
    .send({
      version: review.version,
      categories: [{ name: 'New category', igdbUrls: [game(4).igdbUrl] }]
    })
    .expect(200);
  const voting = await action('start-voting', { closesAt: future() });
  expect(voting.nominationCategories).toHaveLength(2);
  expect(voting.nominations[0].selections[0].games[0].igdbId).toBe(1);
  expect(voting.votingCategories[0].name).toBe('New category');
});

test('keeps ballots, totals and unpublished winners private through explicit confirmation and publication', async () => {
  let edition = await prepareVoting();
  const category = edition.votingCategories[0];
  for (const ids of [[1], [2, 3], []])
    await member
      .post('/api/v2/awards/ballots')
      .send({ editionId: edition.id, selections: [selection(category, ids)] })
      .expect(400);
  await member
    .post('/api/v2/awards/ballots')
    .send({ editionId: edition.id, selections: [selection(category, [2])] })
    .expect(200);
  await helper
    .post('/api/v2/awards/ballots')
    .send({ editionId: edition.id, selections: [selection(category, [3])] })
    .expect(200);
  const votingView = (await member.get('/api/v2/awards').expect(200)).body.edition;
  expect(votingView.voted).toBe(true);
  expect(votingView).not.toHaveProperty('votingResults');
  expect(votingView.categories[0]).not.toHaveProperty('winner');
  expect((await view()).votingResults[0].tiedIgdbIds).toEqual([2, 3]);
  await Edition.updateOne(
    { _id: edition.id },
    { $set: { votingClosesAt: new Date(Date.now() - 1) } }
  );
  edition = await view();
  expect(edition.status).toBe('closed');
  await member
    .post('/api/v2/awards/ballots')
    .send({ editionId: edition.id, selections: [selection(category, [3])] })
    .expect(409);
  await admin.post('/api/v2/admin/awards/publish').send({ version: edition.version }).expect(400);
  await admin
    .put('/api/v2/admin/awards/winners')
    .send({ version: edition.version, winners: [{ categoryId: category.id, igdbId: 1 }] })
    .expect(400);
  const winners = edition.votingCategories.map((entry) => ({
    categoryId: entry.id,
    igdbId: entry.finalists[0].igdbId
  }));
  await admin
    .put('/api/v2/admin/awards/winners')
    .send({ version: edition.version, winners })
    .expect(200);
  expect((await member.get('/api/v2/awards').expect(200)).body.edition).toMatchObject({
    status: 'closed',
    categories: []
  });
  edition = await action('publish');
  const published = (await member.get('/api/v2/awards').expect(200)).body.edition;
  expect(published.status).toBe('published');
  expect(published.categories[0].winner).toMatchObject({
    igdbId: 2,
    title: 'Game 2',
    platforms: ['Nintendo Switch']
  });
  expect(published.categories[0]).not.toHaveProperty('finalists');
  expect(published).not.toHaveProperty('votingResults');
  await admin
    .put('/api/v2/admin/awards/winners')
    .send({ version: edition.version, winners })
    .expect(409);
  await admin
    .post('/api/v2/admin/awards/start-voting')
    .send({ version: edition.version, closesAt: future() })
    .expect(409);
});
