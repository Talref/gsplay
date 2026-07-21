const { URL } = require('node:url');

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
    uploadMaxBytes: asInteger(environment.UPLOAD_MAX_BYTES, 10 * 1024 * 1024, 'UPLOAD_MAX_BYTES', 1024, 25 * 1024 * 1024),
    auth: {
      accessSecret: environment.JWT_ACCESS_SECRET || environment.JWT_SECRET,
      refreshSecret: environment.JWT_REFRESH_SECRET,
      accessTtl: environment.JWT_ACCESS_TTL || '15m',
      refreshTtl: environment.JWT_REFRESH_TTL || '30d',
      cookieSecure: asBoolean(environment.COOKIE_SECURE, isProduction),
      cookieSameSite: environment.COOKIE_SAME_SITE || 'lax'
    },
    providers: {
      steamApiKey: environment.STEAM_API_KEY || null,
       igdbClientId: environment.IGDB_CLIENT_ID || null,
       igdbClientSecret: environment.IGDB_CLIENT_SECRET || null,
      retroAchievementsUsername: environment.RETROACHIEVEMENT_USERNAME || null,
      retroAchievementsApiKey: environment.RETROACHIEVEMENT_API_KEY || null
    }
  };

  new URL(config.publicAppUrl);
  if (!['lax', 'strict', 'none'].includes(config.auth.cookieSameSite)) {
    throw new Error('COOKIE_SAME_SITE must be lax, strict, or none');
  }
  if (config.auth.cookieSameSite === 'none' && !config.auth.cookieSecure) {
    throw new Error('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true');
  }
  if (isProduction) {
    config.auth.accessSecret = requireSecret(environment, 'JWT_ACCESS_SECRET');
    config.auth.refreshSecret = requireSecret(environment, 'JWT_REFRESH_SECRET');
  }
  return Object.freeze(config);
}

module.exports = { loadEnvironment };