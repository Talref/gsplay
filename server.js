/**
 * Main Server Application
 * Configured using centralized configuration files
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Import configuration files
const appConfig = require('./config/app');
const igdbConfig = require('./config/igdb');

// Import routes and middleware
const userRoutes = require('./src/routes/userRoutes');
const { apiLimiter } = require('./src/middleware/rateLimiter');
const errorHandler = require('./src/middleware/error/errorHandler');
const requestLogger = require('./src/middleware/logging/requestLogger');
const { sanitizeInput } = require('./src/middleware/validation/sanitizeInput');

const app = express();

// Server Configuration from config
const { server, database, security } = appConfig;

// Middleware
app.use(helmet());
app.use(requestLogger); // Request logging (must be early)
app.use(express.json({ limit: '10mb' })); // Use config for limits
app.use(sanitizeInput); // Input sanitization (after JSON parsing)
app.use(cookieParser());
app.use(cors({
  origin: server.cors.origin,
  credentials: server.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Apply rate limiting if enabled
if (appConfig.features.rateLimiting !== false) {
  app.use('/api', apiLimiter);
}

// Test endpoint to verify configuration is working
app.get('/config-test', (req, res) => {
  res.json({
    status: 'Configuration loaded successfully',
    environment: server.environment,
    port: server.port,
    database: database.uri ? 'Configured' : 'Not configured',
    igdb: igdbConfig.api.clientId ? 'Configured' : 'Not configured',
    features: appConfig.features
  });
});

// Routes
app.use('/api', userRoutes);

// Global error handler (must be last middleware)
app.use(errorHandler);

// Connect to MongoDB using config
mongoose.connect(database.uri, database.options)
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    // Initialize IGDB lookup tables if enabled
    if (igdbConfig.lookups.enabled !== false) {
      try {
        const igdbService = require('./src/services/igdbService');
        await igdbService.initializeLookupTables();
        console.log('✅ IGDB lookup tables initialized successfully');
      } catch (error) {
        console.warn('⚠️ Failed to initialize IGDB lookup tables:', error.message);
        console.warn('📝 IGDB functionality may be limited until resolved');
      }
    }
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.warn('⚠️ Server starting without database connection');
    console.warn('📝 Some features may not work until database is configured');
    // Don't exit - let server start for testing configuration
  });

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: server.environment
  });
});

// Start the server using config
app.listen(server.port, server.host, () => {
  console.log(`🚀 Server running at http://${server.host}:${server.port}/`);
  console.log(`📝 Environment: ${server.environment}`);
  console.log(`🔗 CORS Origin: ${server.cors.origin}`);
  console.log(`📊 Log Level: ${process.env.LOG_LEVEL}`);
});
