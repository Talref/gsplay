const { MongoMemoryServer } = require('mongodb-memory-server');
const { loadEnvironment } = require('../src/v2/config/environment');
const { connectDatabase, disconnectDatabase } = require('../src/v2/database');
const { createApp } = require('../src/v2/app');
const User = require('../src/v2/models/User');
const CanonicalGame = require('../src/v2/models/CanonicalGame');
const LibraryItem = require('../src/v2/models/LibraryItem');

async function start() {
  const mongo = await MongoMemoryServer.create();
  const config = loadEnvironment({
    NODE_ENV: 'test', HOST: '127.0.0.1', PORT: '3100', MONGO_URI: mongo.getUri(),
    PUBLIC_APP_URL: 'http://127.0.0.1:5174', CORS_ORIGINS: 'http://127.0.0.1:5174',
    JWT_ACCESS_SECRET: 'e'.repeat(32), JWT_REFRESH_SECRET: 'r'.repeat(32), COOKIE_SECURE: 'false'
  });
  await connectDatabase(config);
  const [admin, friend] = await Promise.all([
    User.create({ usernameNormalized: 'e2e admin', usernameDisplay: 'E2E Admin', role: 'admin', passwordHash: await User.hashPassword('correct-horse-battery-staple') }),
    User.create({ usernameNormalized: 'e2e friend', usernameDisplay: 'E2E Friend', passwordHash: await User.hashPassword('correct-horse-battery-staple') })
  ]);
  const game = await CanonicalGame.create({ canonicalTitle: 'Aqua Quest', normalizedTitle: 'aqua quest', summary: 'A polished little quest through aqua ruins, with enough trouble to keep the compari occupied.', genres: ['Adventure', 'Puzzle'], platforms: ['PC'], gameModes: ['Co-operative'], companies: ['Aqua Studio'], videos: ['dQw4w9WgXcQ'], rating: 87, releaseDate: new Date('2024-06-12') });
  await LibraryItem.create([
    { userId: admin._id, provider: 'steam', providerGameId: 'aqua-quest', providerTitle: 'Aqua Quest', normalizedTitle: 'aqua quest', canonicalGameId: game._id, matchStatus: 'auto_matched', source: 'api' },
    { userId: friend._id, provider: 'gog', providerGameId: 'aqua-quest', providerTitle: 'Aqua Quest', normalizedTitle: 'aqua quest', canonicalGameId: game._id, matchStatus: 'auto_matched', source: 'upload' }
  ]);
  const server = createApp(config).listen(config.port, config.host);
  const stop = async () => { await new Promise((resolve) => server.close(resolve)); await disconnectDatabase(); await mongo.stop(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
start().catch((error) => { console.error(error); process.exit(1); });