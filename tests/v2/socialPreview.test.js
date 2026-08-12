const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const { METADATA_MARKER } = require('../../src/v2/http/socialPreview');

const template = `<!doctype html>
<html lang="it">
  <head>
    <title>Static GSPlay</title>
    ${METADATA_MARKER}
  </head>
  <body><div id="root"></div></body>
</html>`;

const config = loadEnvironment({
  NODE_ENV: 'test',
  MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
  PUBLIC_APP_URL: 'https://gsplay.example/community/',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32)
});

describe('social preview HTML infrastructure', () => {
  test('rejects a frontend template that cannot receive metadata', () => {
    expect(() => createApp(config, { frontendTemplate: '<html><head></head></html>' })).toThrow(
      METADATA_MARKER
    );
  });

  test('returns generic absolute metadata in the initial SPA response', async () => {
    const app = createApp(config, { frontendTemplate: template });
    const response = await request(app)
      .get('/some/unsupported/page?private=value')
      .set('Accept', 'text/html')
      .expect(200);

    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.text).toContain('<title>GSPlay</title>');
    expect(response.text).toContain(
      '<meta property="og:url" content="https://gsplay.example/some/unsupported/page" />'
    );
    expect(response.text).toContain(
      '<meta property="og:image" content="https://gsplay.example/gslogo.png" />'
    );
    expect(response.text).toContain('<meta property="og:type" content="website" />');
    expect(response.text).toContain('<meta name="twitter:card" content="summary" />');
    expect(response.text).not.toContain('private=value');
    expect(response.text).not.toContain(METADATA_MARKER);
  });

  test('injects resolver metadata safely without changing React rendering', async () => {
    const app = createApp(config, {
      frontendTemplate: template,
      socialMetadataResolver: async (req) =>
        req.path === '/shared'
          ? {
              title: 'Roma & <script>alert("no")</script>',
              description: 'Daje "forte" & sicuro',
              image: 'https://images.example/cover.jpg#fragment',
              url: 'https://malicious.example/private',
              type: 'article',
              twitterCard: 'summary_large_image'
            }
          : null
    });
    const response = await request(app).get('/shared').set('Accept', 'text/html').expect(200);

    expect(response.text).toContain(
      '<title>Roma &amp; &lt;script&gt;alert(&quot;no&quot;)&lt;/script&gt;</title>'
    );
    expect(response.text).toContain('content="Daje &quot;forte&quot; &amp; sicuro"');
    expect(response.text).toContain('content="https://images.example/cover.jpg"');
    expect(response.text).toContain('content="https://gsplay.example/shared"');
    expect(response.text).not.toContain('malicious.example');
    expect(response.text).toContain('<meta property="og:type" content="article" />');
    expect(response.text).toContain('<div id="root"></div>');
    expect(response.text).not.toContain('<script>alert');
  });

  test('keeps API misses as JSON 404 responses even when HTML is accepted', async () => {
    const app = createApp(config, { frontendTemplate: template });
    const response = await request(app)
      .get('/api/v2/not-a-real-endpoint')
      .set('Accept', 'text/html')
      .expect(404);

    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body.error.code).toBe('not_found');
  });

  test('falls back to generic metadata when a page resolver is unavailable', async () => {
    const app = createApp(config, {
      frontendTemplate: template,
      socialMetadataResolver: async () => {
        throw new Error('Catalogue unavailable');
      }
    });
    const response = await request(app).get('/deleted-resource').set('Accept', 'text/html').expect(200);

    expect(response.text).toContain('<title>GSPlay</title>');
    expect(response.text).toContain(
      '<meta property="og:url" content="https://gsplay.example/deleted-resource" />'
    );
  });

  test('does not return the SPA shell for file-like or JSON requests', async () => {
    const app = createApp(config, { frontendTemplate: template });
    await request(app).get('/missing.txt').set('Accept', 'text/html').expect(404);
    await request(app).get('/unsupported').set('Accept', 'application/json').expect(404);
  });
});
