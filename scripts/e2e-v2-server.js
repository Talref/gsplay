const { MongoMemoryServer } = require('mongodb-memory-server');
const { loadEnvironment } = require('../src/v2/config/environment');
const { connectDatabase, disconnectDatabase } = require('../src/v2/database');
const { createApp } = require('../src/v2/app');
const User = require('../src/v2/models/User');
const CanonicalGame = require('../src/v2/models/CanonicalGame');
const LibraryItem = require('../src/v2/models/LibraryItem');
const CasualFridayRotationGame = require('../src/v2/models/CasualFridayRotationGame');
const CasualFridayPlaylist = require('../src/v2/models/CasualFridayPlaylist');
const CasualFridayPlaylistEntry = require('../src/v2/models/CasualFridayPlaylistEntry');
const ServerStatusSnapshot = require('../src/v2/models/ServerStatusSnapshot');
const { nextFridayWindow } = require('../src/v2/services/casualFridayService');

async function start() {
  const mongo = await MongoMemoryServer.create();
  const config = loadEnvironment({
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '3100',
    MONGO_URI: mongo.getUri(),
    PUBLIC_APP_URL: 'http://127.0.0.1:5174',
    CORS_ORIGINS: 'http://127.0.0.1:5174',
    JWT_ACCESS_SECRET: 'e'.repeat(32),
    JWT_REFRESH_SECRET: 'r'.repeat(32),
    COOKIE_SECURE: 'false'
  });
  await connectDatabase(config);
  const [admin, friend] = await Promise.all([
    User.create({
      usernameNormalized: 'e2e admin',
      usernameDisplay: 'E2E Admin',
      role: 'admin',
      passwordHash: await User.hashPassword('correct-horse-battery-staple')
    }),
    User.create({
      usernameNormalized: 'e2e friend',
      usernameDisplay: 'E2E Friend',
      passwordHash: await User.hashPassword('correct-horse-battery-staple')
    })
  ]);
  const game = await CanonicalGame.create({
    canonicalTitle: 'Aqua Quest',
    normalizedTitle: 'aqua quest',
    summary:
      'A polished little quest through aqua ruins, with enough trouble to keep the compari occupied.',
    genres: ['Adventure', 'Puzzle'],
    platforms: ['PC'],
    gameModes: ['Co-operative'],
    companies: ['Aqua Studio'],
    videos: ['dQw4w9WgXcQ'],
    rating: 87,
    releaseDate: new Date('2024-06-12')
  });
  await LibraryItem.create([
    {
      userId: admin._id,
      provider: 'steam',
      providerGameId: 'aqua-quest',
      providerTitle: 'Aqua Quest',
      normalizedTitle: 'aqua quest',
      canonicalGameId: game._id,
      matchStatus: 'auto_matched',
      source: 'api'
    },
    {
      userId: friend._id,
      provider: 'gog',
      providerGameId: 'aqua-quest',
      providerTitle: 'Aqua Quest',
      normalizedTitle: 'aqua quest',
      canonicalGameId: game._id,
      matchStatus: 'auto_matched',
      source: 'upload'
    }
  ]);
  const secondGame = await CanonicalGame.create({
    canonicalTitle: 'Budget Brawlers',
    normalizedTitle: 'budget brawlers',
    summary: 'Fast rounds, large lobbies, and enough chaos for a Friday night.',
    genres: ['Party', 'Action'],
    platforms: ['PC'],
    gameModes: ['Multiplayer']
  });
  const aquaOffer = {
    shop: 'E2E Games',
    url: 'https://isthereanydeal.com/game/aqua-quest/deal',
    price: 11.99,
    currency: 'EUR',
    regularPrice: 19.99,
    discountPercent: 40,
    retrievedAt: new Date()
  };
  const budgetOffer = {
    shop: 'E2E Games',
    url: 'https://isthereanydeal.com/game/budget-brawlers/deal',
    price: 7.49,
    currency: 'EUR',
    regularPrice: 24.99,
    discountPercent: 70,
    retrievedAt: new Date()
  };
  const rotations = await CasualFridayRotationGame.create([
    {
      canonicalGameId: game._id,
      displayTitle: 'Aqua Quest',
      info: 'Explore the ruins together and solve the aqua puzzles.',
      playerCountMin: 2,
      playerCountMax: 4,
      playerCountLabel: '2–4 compari',
      joinInstructions: 'Join the host lobby from your friends list.',
      hostMode: 'host_runs',
      acquisitionKind: 'owned_store',
      itadGameId: 'aqua-quest-itad',
      itadStatus: 'verified',
      itadOffer: aquaOffer,
      itadOfferCheckedAt: new Date(),
      addedBy: admin._id,
      updatedBy: admin._id
    },
    {
      canonicalGameId: secondGame._id,
      displayTitle: 'Budget Brawlers',
      info: 'Quick party rounds with drop-in multiplayer.',
      playerCountMin: 2,
      playerCountMax: 12,
      playerCountLabel: '2–12 compari',
      hostMode: 'none',
      acquisitionKind: 'owned_store',
      itadGameId: 'budget-brawlers-itad',
      itadStatus: 'verified',
      itadOffer: budgetOffer,
      itadOfferCheckedAt: new Date(),
      addedBy: admin._id,
      updatedBy: admin._id
    }
  ]);
  const window = nextFridayWindow();
  const playlist = await CasualFridayPlaylist.create({
    ...window,
    createdBy: admin._id,
    updatedBy: admin._id
  });
  await CasualFridayPlaylistEntry.create([
    {
      playlistId: playlist._id,
      rotationGameId: rotations[0]._id,
      canonicalGameId: game._id,
      position: 1,
      selectedBy: admin._id,
      snapshots: {
        game: {
          id: String(game._id),
          title: game.canonicalTitle,
          artwork: game.artwork,
          summary: game.summary,
          genres: game.genres
        },
        rotation: {
          displayTitle: rotations[0].displayTitle,
          artwork: game.artwork,
          info: rotations[0].info,
          playerCountMin: 2,
          playerCountMax: 4,
          playerCountLabel: '2–4 compari',
          joinInstructions: rotations[0].joinInstructions,
          hostMode: 'host_runs',
          acquisitionKind: 'owned_store'
        },
        itad: {
          status: 'verified',
          gameId: rotations[0].itadGameId,
          title: rotations[0].displayTitle,
          checkedAt: new Date(),
          offer: aquaOffer
        }
      }
    },
    {
      playlistId: playlist._id,
      rotationGameId: rotations[1]._id,
      canonicalGameId: secondGame._id,
      position: 2,
      selectedBy: admin._id,
      snapshots: {
        game: {
          id: String(secondGame._id),
          title: secondGame.canonicalTitle,
          artwork: secondGame.artwork,
          summary: secondGame.summary,
          genres: secondGame.genres
        },
        rotation: {
          displayTitle: rotations[1].displayTitle,
          artwork: secondGame.artwork,
          info: rotations[1].info,
          playerCountMin: 2,
          playerCountMax: 12,
          playerCountLabel: '2–12 compari',
          hostMode: 'none',
          acquisitionKind: 'owned_store'
        },
        itad: {
          status: 'verified',
          gameId: rotations[1].itadGameId,
          title: rotations[1].displayTitle,
          checkedAt: new Date(),
          offer: budgetOffer
        }
      }
    }
  ]);
  await ServerStatusSnapshot.create({
    singletonKey: 'current',
    sourceUpdatedAt: new Date(),
    receivedAt: new Date(),
    servers: [
      {
        groupId: 'landover',
        groupName: 'Landover GS server',
        managerMention: '<@111111111111111111>',
        name: 'GSplay Palworld',
        identifier: '8209baa0',
        status: 'running',
        uptimeMilliseconds: 14276045
      },
      {
        groupId: 'jamserver',
        groupName: 'Jam GS server',
        managerMention: '<@222222222222222222>',
        name: 'Project Zomboid GS',
        identifier: '64e0cec5-40ae-4369-9af2-17c750810979',
        status: 'idle',
        players: 0,
        maxPlayers: 24
      }
    ]
  });
  const itadClient = {
    lookupTitle: async (title) => ({ outcome: 'matched', game: { id: `${title}-itad`, title } }),
    bestOffers: async (ids) =>
      new Map(ids.map((id) => [id, id === 'budget-brawlers-itad' ? budgetOffer : aquaOffer]))
  };
  const server = createApp(config, { itadClient }).listen(config.port, config.host);
  const stop = async () => {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
    await mongo.stop();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
start().catch((error) => {
  console.error(error);
  process.exit(1);
});
