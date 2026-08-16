const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const MostWantedSnapshot = require('../../src/v2/models/MostWantedSnapshot');
const User = require('../../src/v2/models/User');
const CanonicalGame = require('../../src/v2/models/CanonicalGame');

const config = loadEnvironment({
  NODE_ENV: 'test',
  MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  MOST_WANTED_STALE_AFTER_MS: '3600000'
});
const app = createApp(config);
const password = 'correct-horse-battery-staple';

async function authenticate() {
  const user = await User.create({
    usernameNormalized: 'wanted member',
    usernameDisplay: 'Wanted Member',
    passwordHash: await User.hashPassword(password)
  });
  const agent = request.agent(app);
  await agent.post('/api/v2/auth/login').send({ username: user.usernameDisplay, password }).expect(200);
  return { agent, user };
}

describe('Most Wanted API', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('requires membership and returns a clean unavailable state before the first snapshot', async () => {
    await request(app).get('/api/v2/most-wanted').expect(401);
    const { agent } = await authenticate();
    expect((await agent.get('/api/v2/most-wanted').expect(200)).body).toEqual({
      available: false,
      stale: false,
      generatedAt: null,
      games: [],
      page: { number: 1, size: 24, total: 0, hasMore: false }
    });
  });

  test('returns cached rankings, member details, coverage, staleness, and pagination', async () => {
    const { agent, user } = await authenticate();
    const games = await CanonicalGame.create(
      ['Alpha', 'Beta', 'Gamma'].map((title) => ({
        canonicalTitle: title,
        normalizedTitle: title.toLowerCase(),
        artwork: `https://images.example/${title.toLowerCase()}-current.jpg`
      }))
    );
    await MostWantedSnapshot.create({
      key: 'current',
      generatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      lastAttemptAt: new Date(),
      lastError: { code: 'no_accessible_profiles', message: 'Cached data preserved' },
      profilesEligible: 2,
      profilesIncluded: 1,
      profilesUnavailable: 1,
      games: games.map((game, index) => ({
        canonicalGameId: game._id,
        title: game.canonicalTitle,
        artwork: `https://images.example/${game.canonicalTitle.toLowerCase()}-stale.jpg`,
        wishlistCount: 3 - index,
        ownerCount: index,
        wishlistedBy: [{ userId: user._id, username: user.usernameDisplay }],
        ownedBy: index ? [{ userId: user._id, username: user.usernameDisplay }] : []
      }))
    });
    const response = await agent.get('/api/v2/most-wanted?page=2&pageSize=2').expect(200);
    expect(response.body).toMatchObject({
      available: true,
      stale: true,
      page: { number: 2, size: 2, total: 3, hasMore: false }
    });
    expect(response.body.games).toEqual([
      expect.objectContaining({
        id: games[2]._id.toString(),
        rank: 3,
        title: 'Gamma',
        artwork: 'https://images.example/gamma-current.jpg',
        wishlistCount: 1,
        ownerCount: 2,
        wishlistedBy: [{ id: user._id.toString(), username: 'Wanted Member' }],
        ownedBy: [{ id: user._id.toString(), username: 'Wanted Member' }]
      })
    ]);
  });

  test('does not expose the obsolete guessed Steam artwork fallback', async () => {
    const { agent, user } = await authenticate();
    const game = await CanonicalGame.create({
      canonicalTitle: 'Upcoming Game',
      normalizedTitle: 'upcoming game',
      artwork: 'https://cdn.akamai.steamstatic.com/steam/apps/123/header.jpg'
    });
    await MostWantedSnapshot.create({
      key: 'current',
      generatedAt: new Date(),
      profilesEligible: 1,
      profilesIncluded: 1,
      games: [
        {
          canonicalGameId: game._id,
          title: game.canonicalTitle,
          artwork: game.artwork,
          wishlistCount: 1,
          ownerCount: 0,
          wishlistedBy: [{ userId: user._id, username: user.usernameDisplay }]
        }
      ]
    });

    const response = await agent.get('/api/v2/most-wanted').expect(200);
    expect(response.body.games[0].artwork).toBeNull();
  });
});
