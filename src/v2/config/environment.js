const { URL } = require('node:url');
const os = require('node:os');
const path = require('node:path');

const TRUE_VALUES = new Set(['1', 'true', 'yes']);
const FALSE_VALUES = new Set(['0', 'false', 'no']);

function asBoolean(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const normalized = String(value).toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  throw new Error(`Expected a boolean value, received "${value}"`);
}

function asInteger(value, fallback, label, min, max) {
  const parsed = Number.parseInt(value ?? fallback, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function asOrigins(value) {
  const origins = (value || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!origins.length) throw new Error('CORS_ORIGINS must contain at least one origin');
  origins.forEach((origin) => new URL(origin));
  return origins;
}

function asAbsolutePath(value, fallback, label) {
  const result = value || fallback;
  if (!path.isAbsolute(result)) throw new Error(`${label} must be an absolute path`);
  return result;
}

function requireSecret(environment, name) {
  const value = environment[name];
  if (!value || value.startsWith('replace-with-')) {
    throw new Error(`${name} is required`);
  }
  if (value.length < 32) throw new Error(`${name} must be at least 32 characters long`);
  return value;
}

function loadEnvironment(environment = process.env) {
  const nodeEnv = environment.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const mongoUri = environment.MONGO_URI || 'mongodb://127.0.0.1:27017/gsplay';

  if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
    throw new Error('MONGO_URI must be a MongoDB connection URI');
  }

  const config = {
    nodeEnv,
    isProduction,
    host: environment.HOST || '127.0.0.1',
    port: asInteger(environment.PORT, 3000, 'PORT', 1, 65535),
    publicAppUrl: environment.PUBLIC_APP_URL || 'http://localhost:5173',
    corsOrigins: asOrigins(environment.CORS_ORIGINS),
    mongoUri,
    logLevel: environment.LOG_LEVEL || 'info',
    workerEnabled: asBoolean(environment.ENABLE_WORKER, true),
    uploadMaxBytes: asInteger(
      environment.UPLOAD_MAX_BYTES,
      10 * 1024 * 1024,
      'UPLOAD_MAX_BYTES',
      1024,
      25 * 1024 * 1024
    ),
    guide: {
      uploadDir: asAbsolutePath(
        environment.GUIDE_UPLOAD_DIR,
        isProduction ? '/var/lib/gsplay/guide' : path.join(os.tmpdir(), 'gsplay-guide-images'),
        'GUIDE_UPLOAD_DIR'
      ),
      imageMaxBytes: asInteger(
        environment.GUIDE_IMAGE_MAX_BYTES,
        5 * 1024 * 1024,
        'GUIDE_IMAGE_MAX_BYTES',
        1024,
        10 * 1024 * 1024
      )
    },
    serverStatus: {
      integrationToken: environment.SERVER_STATUS_INTEGRATION_TOKEN || null,
      maxBytes: asInteger(
        environment.SERVER_STATUS_MAX_BYTES,
        64 * 1024,
        'SERVER_STATUS_MAX_BYTES',
        1024,
        1024 * 1024
      ),
      rateLimitWindowMs: asInteger(
        environment.SERVER_STATUS_RATE_LIMIT_WINDOW_MS,
        60_000,
        'SERVER_STATUS_RATE_LIMIT_WINDOW_MS',
        1000,
        60 * 60 * 1000
      ),
      rateLimitMax: asInteger(
        environment.SERVER_STATUS_RATE_LIMIT_MAX,
        10,
        'SERVER_STATUS_RATE_LIMIT_MAX',
        1,
        1000
      ),
      staleAfterMs: asInteger(
        environment.SERVER_STATUS_STALE_AFTER_MS,
        3 * 60 * 1000,
        'SERVER_STATUS_STALE_AFTER_MS',
        60_000,
        60 * 60 * 1000
      )
    },
    itad: {
      priceRefreshMs: asInteger(
        environment.ITAD_PRICE_REFRESH_MS,
        60 * 60 * 1000,
        'ITAD_PRICE_REFRESH_MS',
        60_000,
        24 * 60 * 60 * 1000
      )
    },
    igdb: {
      minIntervalMs: asInteger(
        environment.IGDB_MIN_INTERVAL_MS,
        500,
        'IGDB_MIN_INTERVAL_MS',
        250,
        60_000
      ),
      cooldownMs: asInteger(
        environment.IGDB_COOLDOWN_MS,
        60_000,
        'IGDB_COOLDOWN_MS',
        1_000,
        60 * 60 * 1000
      ),
      maintenanceMs: asInteger(
        environment.IGDB_MAINTENANCE_MS,
        15 * 60 * 1000,
        'IGDB_MAINTENANCE_MS',
        60_000,
        24 * 60 * 60 * 1000
      ),
      queueLimit: asInteger(environment.IGDB_QUEUE_LIMIT, 100, 'IGDB_QUEUE_LIMIT', 1, 10_000),
      maxAttempts: asInteger(environment.IGDB_MAX_ATTEMPTS, 6, 'IGDB_MAX_ATTEMPTS', 1, 10),
      recoverLegacyPermanent: asBoolean(environment.IGDB_RECOVER_LEGACY_PERMANENT, !isProduction)
    },
    auth: {
      accessSecret: environment.JWT_ACCESS_SECRET || environment.JWT_SECRET,
      refreshSecret: environment.JWT_REFRESH_SECRET,
      accessTtl: environment.JWT_ACCESS_TTL || '15m',
      refreshTtl: environment.JWT_REFRESH_TTL || '30d',
      cookieSecure: asBoolean(environment.COOKIE_SECURE, isProduction),
      cookieSameSite: environment.COOKIE_SAME_SITE || 'lax',
      rateLimitWindowMs: asInteger(
        environment.AUTH_RATE_LIMIT_WINDOW_MS,
        15 * 60 * 1000,
        'AUTH_RATE_LIMIT_WINDOW_MS',
        60_000,
        24 * 60 * 60 * 1000
      ),
      rateLimitMax: asInteger(environment.AUTH_RATE_LIMIT_MAX, 20, 'AUTH_RATE_LIMIT_MAX', 1, 1_000)
    },
    providers: {
      steamApiKey: environment.STEAM_API_KEY || null,
      igdbClientId:
        environment.IGDB_CLIENT_ID || environment.TW_CLIENT_ID || environment.TW_CLIENTID || null,
      igdbClientSecret:
        environment.IGDB_CLIENT_SECRET ||
        environment.TW_CLIENT_SECRET ||
        environment.TW_CLIENTSECRET ||
        null,
      itadApiKey: environment.ITAD_API_KEY || null,
      retroAchievementsUsername: environment.RETROACHIEVEMENT_USERNAME || null,
      retroAchievementsApiKey: environment.RETROACHIEVEMENT_API_KEY || null
    }
  };

  const publicAppUrl = new URL(config.publicAppUrl);
  if (!['http:', 'https:'].includes(publicAppUrl.protocol)) {
    throw new Error('PUBLIC_APP_URL must use HTTP or HTTPS');
  }
  if (!['lax', 'strict', 'none'].includes(config.auth.cookieSameSite)) {
    throw new Error('COOKIE_SAME_SITE must be lax, strict, or none');
  }
  if (config.auth.cookieSameSite === 'none' && !config.auth.cookieSecure) {
    throw new Error('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true');
  }
  if (isProduction) {
    config.auth.accessSecret = requireSecret(environment, 'JWT_ACCESS_SECRET');
    config.auth.refreshSecret = requireSecret(environment, 'JWT_REFRESH_SECRET');
    config.serverStatus.integrationToken = requireSecret(
      environment,
      'SERVER_STATUS_INTEGRATION_TOKEN'
    );
  }
  return Object.freeze(config);
}

module.exports = { loadEnvironment };
