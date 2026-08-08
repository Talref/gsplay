const { loadEnvironment } = require('../../src/v2/config/environment');

describe('v2 environment configuration', () => {
  const valid = { NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test' };
  test('loads safe development defaults', () => {
    const config = loadEnvironment(valid);
    expect(config.port).toBe(3000);
    expect(config.auth.cookieSecure).toBe(false);
    expect(config.itad.priceRefreshMs).toBe(3600000);
    expect(config.guide).toMatchObject({ imageMaxBytes: 5 * 1024 * 1024 });
    expect(config.guide.uploadDir).toContain('gsplay-guide-images');
  });

  test('validates guide image storage and upload limits', () => {
    expect(() => loadEnvironment({ ...valid, GUIDE_UPLOAD_DIR: 'relative/path' })).toThrow(
      'GUIDE_UPLOAD_DIR'
    );
    expect(() => loadEnvironment({ ...valid, GUIDE_IMAGE_MAX_BYTES: '100' })).toThrow(
      'GUIDE_IMAGE_MAX_BYTES'
    );
    expect(
      loadEnvironment({
        ...valid,
        GUIDE_UPLOAD_DIR: '/var/lib/custom-guide',
        GUIDE_IMAGE_MAX_BYTES: '2097152'
      }).guide
    ).toEqual({ uploadDir: '/var/lib/custom-guide', imageMaxBytes: 2097152 });
  });

  test('validates the ITAD rotation price refresh interval', () => {
    expect(() => loadEnvironment({ ...valid, ITAD_PRICE_REFRESH_MS: '30000' })).toThrow(
      'ITAD_PRICE_REFRESH_MS'
    );
    expect(
      loadEnvironment({ ...valid, ITAD_PRICE_REFRESH_MS: '7200000' }).itad.priceRefreshMs
    ).toBe(7200000);
  });

  test('validates bounded authentication rate-limit configuration', () => {
    expect(() => loadEnvironment({ ...valid, AUTH_RATE_LIMIT_MAX: '0' })).toThrow(
      'AUTH_RATE_LIMIT_MAX'
    );
    expect(
      loadEnvironment({ ...valid, AUTH_RATE_LIMIT_WINDOW_MS: '120000', AUTH_RATE_LIMIT_MAX: '7' })
        .auth
    ).toMatchObject({ rateLimitWindowMs: 120000, rateLimitMax: 7 });
  });

  test('requires independent strong production secrets', () => {
    expect(() =>
      loadEnvironment({
        NODE_ENV: 'production',
        MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay',
        JWT_ACCESS_SECRET: 'a'.repeat(32)
      })
    ).toThrow('JWT_REFRESH_SECRET is required');
  });

  test('rejects insecure same-site none cookies', () => {
    expect(() =>
      loadEnvironment({
        NODE_ENV: 'test',
        MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
        COOKIE_SAME_SITE: 'none',
        COOKIE_SECURE: 'false'
      })
    ).toThrow('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true');
  });

  test('accepts Twitch credential names for IGDB enrichment', () => {
    const config = loadEnvironment({
      NODE_ENV: 'test',
      MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
      TW_CLIENT_ID: 'twitch-client',
      TW_CLIENT_SECRET: 'twitch-secret'
    });
    expect(config.providers).toMatchObject({
      igdbClientId: 'twitch-client',
      igdbClientSecret: 'twitch-secret'
    });
  });

  test('accepts legacy Twitch credential names for IGDB enrichment', () => {
    const config = loadEnvironment({
      NODE_ENV: 'test',
      MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
      TW_CLIENTID: 'legacy-client',
      TW_CLIENTSECRET: 'legacy-secret'
    });
    expect(config.providers).toMatchObject({
      igdbClientId: 'legacy-client',
      igdbClientSecret: 'legacy-secret'
    });
  });
});
