require('dotenv').config();
const { loadEnvironment } = require('../src/core/config/environment');
const { connectDatabase, disconnectDatabase } = require('../src/core/database');
const models = [
  require('../src/core/models/User'),
  require('../src/core/models/LibraryItem'),
  require('../src/core/models/CanonicalGame'),
  require('../src/core/models/GameAlias'),
  require('../src/core/models/SyncJob'),
  require('../src/core/models/RefreshSession'),
  require('../src/core/models/RetroChallenge'),
  require('../src/core/models/RetroChallengeProgress'),
  require('../src/core/models/CanonicalGameMerge'),
  require('../src/core/models/CatalogueReassignment'),
  require('../src/core/models/AdminUserAction'),
  require('../src/core/models/CasualFridayRotationGame'),
  require('../src/core/models/CasualFridayPlaylist'),
  require('../src/core/models/CasualFridayPlaylistEntry'),
  require('../src/core/models/CasualFridayAudit'),
  require('../src/core/models/CasualFridayGameProposal'),
  require('../src/core/models/CasualFridayEvent'),
  require('../src/core/models/CasualFridayResponse'),
  require('../src/core/models/Guide'),
  require('../src/core/models/ServerStatusSnapshot'),
  require('../src/core/models/MostWantedSnapshot'),
  require('../src/core/models/SteamAppCache')
];
const ignoreMissingIndex = (error) => {
  if (!['IndexNotFound', 'NamespaceNotFound'].includes(error.codeName)) throw error;
};

async function bootstrap() {
  const config = loadEnvironment();
  await connectDatabase(config);
  const aliasIndex = { provider: 1, normalizedProviderTitle: 1, canonicalGameId: 1 };
  await models
    .find((model) => model.collection.name === 'game_aliases_v2')
    .collection.dropIndex(aliasIndex)
    .catch(ignoreMissingIndex);
  const rotationCollection = models.find(
    (model) => model.collection.name === 'casual_friday_rotation_games_v2'
  ).collection;
  await rotationCollection.dropIndex('canonicalGameId_1').catch(ignoreMissingIndex);
  const playlistEntryCollection = models.find(
    (model) => model.collection.name === 'casual_friday_playlist_entries_v2'
  ).collection;
  await playlistEntryCollection.updateMany(
    { type: { $exists: false } },
    { $set: { type: 'game' } }
  );
  await playlistEntryCollection
    .dropIndex('playlistId_1_rotationGameId_1')
    .catch(ignoreMissingIndex);
  const retroCollection = models.find(
    (model) => model.collection.name === 'retro_challenges_v2'
  ).collection;
  await retroCollection.dropIndex('retroGameId_1').catch(ignoreMissingIndex);
  const { backfillRetroChallenges } = require('../src/core/migrations/retroCompatibility');
  const retroBackfilled = await backfillRetroChallenges();
  await Promise.all(models.map((model) => model.createIndexes()));
  console.info(
    `Created or verified database indexes for: ${models.map((model) => model.collection.name).join(', ')}`
  );
  if (retroBackfilled) console.info(`Backfilled ${retroBackfilled} Retroclub edition records`);
  await disconnectDatabase();
}
bootstrap().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
