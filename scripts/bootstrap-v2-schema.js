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
  require('../src/v2/models/RetroChallengeProgress'),
  require('../src/v2/models/CanonicalGameMerge'),
  require('../src/v2/models/CatalogueReassignment'),
  require('../src/v2/models/AdminUserAction'),
  require('../src/v2/models/CasualFridayRotationGame'),
  require('../src/v2/models/CasualFridayPlaylist'),
  require('../src/v2/models/CasualFridayPlaylistEntry'),
  require('../src/v2/models/CasualFridayAudit'),
  require('../src/v2/models/CasualFridayGameProposal'),
  require('../src/v2/models/CasualFridayEvent'),
  require('../src/v2/models/CasualFridayResponse'),
  require('../src/v2/models/Guide'),
  require('../src/v2/models/ServerStatusSnapshot'),
  require('../src/v2/models/MostWantedSnapshot'),
  require('../src/v2/models/SteamAppCache')
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
  const { backfillRetroChallenges } = require('../src/v2/services/retroCompatibility');
  const retroBackfilled = await backfillRetroChallenges();
  await Promise.all(models.map((model) => model.createIndexes()));
  console.info(
    `Created or verified v2 indexes for: ${models.map((model) => model.collection.name).join(', ')}`
  );
  if (retroBackfilled) console.info(`Backfilled ${retroBackfilled} Retroclub edition records`);
  await disconnectDatabase();
}
bootstrap().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
