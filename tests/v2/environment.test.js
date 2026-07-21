const { loadEnvironment } = require('../../src/v2/config/environment');

describe('v2 environment configuration', () => {
  test('loads safe development defaults', () => {
    const config = loadEnvironment({ NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test' });
    expect(config.port).toBe(3000);
    expect(config.auth.cookieSecure).toBe(false);
  });

  test('requires independent strong production secrets', () => {
    expect(() => loadEnvironment({ NODE_ENV: 'production', MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay', JWT_ACCESS_SECRET: 'a'.repeat(32) })).toThrow('JWT_REFRESH_SECRET is required');
  });

  test('rejects insecure same-site none cookies', () => {
    expect(() => loadEnvironment({ NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test', COOKIE_SAME_SITE: 'none', COOKIE_SECURE: 'false' })).toThrow('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true');
  });
});