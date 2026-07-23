require('dotenv').config();
const { loadEnvironment } = require('../src/v2/config/environment');
const { connectDatabase, disconnectDatabase } = require('../src/v2/database');
const models = [
  require('../src/v2/models/User'),
  require('../src/v2/models/LibraryItem'),
  require('../src/v2/models/CanonicalGame'),
  require('../src/v2/models/GameAlias'),
  require('../src/v2/models/SyncJob'),
  require('../src/v2/models/RefreshSession'),
  require('../src/v2/models/RetroChallenge'),
  require('../src/v2/models/CanonicalGameMerge')
];

async function bootstrap() {
  const config = loadEnvironment();
  await connectDatabase(config);
  const aliasIndex = { provider: 1, normalizedProviderTitle: 1, canonicalGameId: 1 };
  await models.find((model) => model.collection.name === 'game_aliases_v2').collection.dropIndex(aliasIndex).catch((error) => { if (error.codeName !== 'IndexNotFound') throw error; });
  await Promise.all(models.map((model) => model.createIndexes()));
  console.info(`Created or verified v2 indexes for: ${models.map((model) => model.collection.name).join(', ')}`);
  await disconnectDatabase();
}
bootstrap().catch(async (error) => { console.error(error); await disconnectDatabase(); process.exit(1); });