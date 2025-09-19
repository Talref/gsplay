/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

// Load environment variables for testing
require('dotenv').config({ path: '.env' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise during tests
global.originalConsole = { ...console };

// Suppress console logs during tests unless explicitly needed
beforeAll(() => {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  // Keep console.error for debugging test failures
});

// Restore console after tests
afterAll(() => {
  Object.assign(console, global.originalConsole);
});

// Global test utilities
global.testUtils = {
  // Generate test data
  generateTestGame: (overrides = {}) => ({
    name: 'Test Game',
    genres: ['Action'],
    availablePlatforms: ['PC'],
    gameModes: ['Single Player'],
    rating: 85,
    artwork: 'test-artwork.jpg',
    releaseDate: new Date('2023-01-01'),
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
    const mongoose = require('mongoose');
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
