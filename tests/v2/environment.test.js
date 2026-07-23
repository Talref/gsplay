const { loadEnvironment } = require('../../src/v2/config/environment');

describe('v2 environment configuration', () => {
  const valid = { NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test' };
  test('loads safe development defaults', () => {
    const config = loadEnvironment(valid);
    expect(config.port).toBe(3000);
    expect(config.auth.cookieSecure).toBe(false);
  });

  test('validates bounded authentication rate-limit configuration', () => {
    expect(() => loadEnvironment({ ...valid, AUTH_RATE_LIMIT_MAX: '0' })).toThrow('AUTH_RATE_LIMIT_MAX');
    expect(loadEnvironment({ ...valid, AUTH_RATE_LIMIT_WINDOW_MS: '120000', AUTH_RATE_LIMIT_MAX: '7' }).auth).toMatchObject({ rateLimitWindowMs: 120000, rateLimitMax: 7 });
  });

  test('requires independent strong production secrets', () => {
    expect(() => loadEnvironment({ NODE_ENV: 'production', MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay', JWT_ACCESS_SECRET: 'a'.repeat(32) })).toThrow('JWT_REFRESH_SECRET is required');
  });

  test('rejects insecure same-site none cookies', () => {
    expect(() => loadEnvironment({ NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test', COOKIE_SAME_SITE: 'none', COOKIE_SECURE: 'false' })).toThrow('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true');
  });

  test('accepts Twitch credential names for IGDB enrichment', () => {
    const config = loadEnvironment({ NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test', TW_CLIENT_ID: 'twitch-client', TW_CLIENT_SECRET: 'twitch-secret' });
    expect(config.providers).toMatchObject({ igdbClientId: 'twitch-client', igdbClientSecret: 'twitch-secret' });
  });

  test('accepts legacy Twitch credential names for IGDB enrichment', () => {
    const config = loadEnvironment({ NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test', TW_CLIENTID: 'legacy-client', TW_CLIENTSECRET: 'legacy-secret' });
    expect(config.providers).toMatchObject({ igdbClientId: 'legacy-client', igdbClientSecret: 'legacy-secret' });
  });
});