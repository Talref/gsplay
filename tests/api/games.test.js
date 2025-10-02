/**
 * Games API Integration Tests
 * Tests for game search and retrieval endpoints
 */

const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../../server');
const Game = require('../../src/models/Game');
// testUtils is available globally from setup.js

describe('Games API', () => {
  beforeAll(async () => {
    // Wait for main database connection to be ready
    if (mongoose.connection.readyState === 0) {
      await new Promise(resolve => {
        mongoose.connection.once('connected', resolve);
      });
    }
  });

  beforeEach(async () => {
    // Clean database before each test
    await testUtils.cleanupDatabase();
  });

  describe('GET /api/games/search', () => {
    beforeEach(async () => {
      // Create test games
      const games = [
        testUtils.generateTestGame({
          name: 'Super Mario Bros',
          genres: ['Platform', 'Adventure'],
          availablePlatforms: ['NES', 'SNES']
        }),
        testUtils.generateTestGame({
          name: 'The Legend of Zelda',
          genres: ['Action', 'Adventure'],
          availablePlatforms: ['NES']
        }),
        testUtils.generateTestGame({
          name: 'Final Fantasy',
          genres: ['RPG'],
          availablePlatforms: ['SNES']
        })
      ];

      await Game.insertMany(games);
    });

    test('should return all games when no filters applied', async () => {
      const response = await request(app)
        .get('/api/games/search')
        .expect(200);

      expect(response.body.games).toHaveLength(3);
      expect(response.body.pagination.total).toBe(3);
      expect(response.body.pagination.page).toBe(1);
    });

    test('should filter games by name', async () => {
      const response = await request(app)
        .get('/api/games/search?name=Mario')
        .expect(200);

      expect(response.body.games).toHaveLength(1);
      expect(response.body.games[0].name).toBe('Super Mario Bros');
      expect(response.body.pagination.total).toBe(1);
    });

    test('should filter games by genre', async () => {
      const response = await request(app)
        .get('/api/games/search?genres=Adventure')
        .expect(200);

      expect(response.body.games).toHaveLength(2);
      const gameNames = response.body.games.map(g => g.name).sort();
      expect(gameNames).toEqual(['Super Mario Bros', 'The Legend of Zelda']);
    });

    test('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/games/search?page=1&limit=2')
        .expect(200);

      expect(response.body.games).toHaveLength(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.total).toBe(3);
      expect(response.body.pagination.hasNext).toBe(true);
      expect(response.body.pagination.nextPage).toBe(2);
    });

    test('should return empty results for non-existent games', async () => {
      const response = await request(app)
        .get('/api/games/search?name=NonExistentGame')
        .expect(200);

      expect(response.body.games).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
    });

    test('should handle invalid parameters gracefully', async () => {
      const response = await request(app)
        .get('/api/games/search?page=invalid&limit=notanumber')
        .expect(200);

      // Should use default values
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
    });

    test('should sort games by owner count', async () => {
      // Create games with different numbers of owners (unique names)
      const games = [
        testUtils.generateTestGame({
          name: 'Sorting Test Game With Two Owners',
          owners: [
            { userId: new mongoose.Types.ObjectId(), platforms: ['PC'] },
            { userId: new mongoose.Types.ObjectId(), platforms: ['PC'] }
          ]
        }),
        testUtils.generateTestGame({
          name: 'Sorting Test Game With No Owners',
          owners: []
        }),
        testUtils.generateTestGame({
          name: 'Sorting Test Game With One Owner',
          owners: [{ userId: new mongoose.Types.ObjectId(), platforms: ['PC'] }]
        })
      ];

      await Game.insertMany(games);

      const response = await request(app)
        .get('/api/games/search?sortBy=ownerCount&sortOrder=asc')
        .expect(200);

      expect(response.body.games).toHaveLength(3);

      // Games should be sorted by owner count ascending (0, 1, 2)
      expect(response.body.games[0].name).toBe('Sorting Test Game With No Owners');
      expect(response.body.games[0].ownerCount).toBe(0);

      expect(response.body.games[1].name).toBe('Sorting Test Game With One Owner');
      expect(response.body.games[1].ownerCount).toBe(1);

      expect(response.body.games[2].name).toBe('Sorting Test Game With Two Owners');
      expect(response.body.games[2].ownerCount).toBe(2);
    });

    test('should sort games by owner count descending', async () => {
      // Create games with different numbers of owners (unique names)
      const games = [
        testUtils.generateTestGame({
          name: 'Sorting Test Game Desc With No Owners',
          owners: []
        }),
        testUtils.generateTestGame({
          name: 'Sorting Test Game Desc With Two Owners',
          owners: [
            { userId: new mongoose.Types.ObjectId(), platforms: ['PC'] },
            { userId: new mongoose.Types.ObjectId(), platforms: ['PC'] }
          ]
        }),
        testUtils.generateTestGame({
          name: 'Sorting Test Game Desc With One Owner',
          owners: [{ userId: new mongoose.Types.ObjectId(), platforms: ['PC'] }]
        })
      ];

      await Game.insertMany(games);

      const response = await request(app)
        .get('/api/games/search?sortBy=ownerCount&sortOrder=desc')
        .expect(200);

      expect(response.body.games).toHaveLength(3);

      // Games should be sorted by owner count descending (2, 1, 0)
      expect(response.body.games[0].name).toBe('Sorting Test Game Desc With Two Owners');
      expect(response.body.games[0].ownerCount).toBe(2);

      expect(response.body.games[1].name).toBe('Sorting Test Game Desc With One Owner');
      expect(response.body.games[1].ownerCount).toBe(1);

      expect(response.body.games[2].name).toBe('Sorting Test Game Desc With No Owners');
      expect(response.body.games[2].ownerCount).toBe(0);
    });
  });

  describe('GET /api/games/:id', () => {
    let testGame;

    beforeEach(async () => {
      testGame = await Game.create(testUtils.generateTestGame({
        name: 'Test Game Details',
        description: 'A detailed test game',
        owners: [{
          userId: new mongoose.Types.ObjectId(),
          platforms: ['PC']
        }]
      }));
    });

    test('should return game details for valid ID', async () => {
      const response = await request(app)
        .get(`/api/games/${testGame._id}`)
        .expect(200);

      expect(response.body.name).toBe('Test Game Details');
      expect(response.body.description).toBe('A detailed test game');
      expect(response.body.ownerCount).toBe(1);
    });

    test('should return 404 for non-existent game', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/games/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('Game not found');
    });

    test('should return 400 for invalid ObjectId', async () => {
      const response = await request(app)
        .get('/api/games/invalid-id')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_FORMAT');
      expect(response.body.error.message).toBe('Invalid game ID format');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Force a database disconnection to simulate error
      await mongoose.connection.close();

      const response = await request(app)
        .get('/api/games/search')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');

      // Note: In a real scenario, you'd need to handle reconnection
      // For this test, we skip reconnection to avoid conflicts
    });
  });
});
