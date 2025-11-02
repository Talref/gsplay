/**
 * Application Configuration
 * Main application settings and constants
 */

const path = require('path');

module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    environment: process.env.NODE_ENV || 'development',
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true
    }
  },

  // Security Configuration
  security: {
    jwt: {
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
    },
    bcrypt: {
      rounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    }
  },

  // Database Configuration
  database: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/gsplay',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    }
  },

  // File Upload Configuration
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['application/json'],
    tempDir: path.join(__dirname, '../temp')
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
    file: {
      enabled: process.env.LOG_TO_FILE === 'true',
      path: process.env.LOG_FILE_PATH || path.join(__dirname, '../logs/app.log')
    }
  },

  // Cache Configuration
  cache: {
    ttl: 300, // 5 minutes default TTL
    maxSize: 1000 // Maximum number of items in cache
  },

  // Feature Flags
  features: {
    igdbEnrichment: process.env.ENABLE_IGDB_ENRICHMENT !== 'false',
    rateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
    detailedLogging: process.env.ENABLE_DETAILED_LOGGING === 'true'
  }
};
