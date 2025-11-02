/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Load environment variables for testing
require('dotenv').config({ path: '.env' });

// Set test environment
process.env.NODE_ENV = 'test';

// SAFETY CHECK: Prevent tests from running against production database
const mongoUri = process.env.MONGO_URI || '';
if (mongoUri.includes('mongodb+srv://') ||
    mongoUri.includes('production') ||
    mongoUri.includes('prod') ||
    (!mongoUri.includes('localhost') && !mongoUri.includes('127.0.0.1'))) {
  console.error('❌ SAFETY ERROR: Tests are trying to connect to a non-localhost database!');
  console.error('This could damage production data. Aborting tests.');
  console.error('MongoDB URI:', mongoUri);
  process.exit(1);
}

let mongoServer;

// Mock console methods to reduce noise during tests
global.originalConsole = { ...console };

// Suppress console logs during tests unless explicitly needed
beforeAll(async () => {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  // Keep console.error for debugging test failures

  // Start in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Override the MONGO_URI for tests
  process.env.MONGO_URI = mongoUri;

  // Connect to the in-memory database
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}, 60000);

// Restore console and cleanup after tests
afterAll(async () => {
  Object.assign(console, global.originalConsole);

  // Close database connection
  await mongoose.connection.close();

  // Stop the in-memory server
  if (mongoServer) {
    await mongoServer.stop();
  }
}, 60000);

// Global test utilities
global.testUtils = {
  // Generate test data
  generateTestGame: (overrides = {}) => ({
    name: `Test Game ${Math.random().toString(36).substr(2, 9)}`, // Unique name by default
    genres: ['Action'],
    availablePlatforms: ['PC'],
    gameModes: ['Single Player'],
    rating: 85,
    artwork: 'test-artwork.jpg',
    releaseDate: new Date('2023-01-01'),
    igdbId: Math.floor(Math.random() * 1000000), // Required for search
    ...overrides
  }),

  generateTestUser: (overrides = {}) => ({
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    ...overrides
  }),

  // Clean up database after tests
  cleanupDatabase: async () => {
    if (mongoose.connection.readyState === 1) {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany({});
      }
    }
  },

  // Wait for database operations
  waitForDb: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))
};

// Set longer timeout for database operations
jest.setTimeout(30000);
