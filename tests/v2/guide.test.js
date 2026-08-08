const request = require('supertest');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const Guide = require('../../src/v2/models/Guide');
const User = require('../../src/v2/models/User');
const { detectImageType } = require('../../src/v2/services/guideImageService');

let app;
let uploadDir;
const password = 'correct-horse-battery-staple';

async function authenticatedAgent(username, role = 'member') {
  await User.create({
    usernameNormalized: username.toLowerCase(),
    usernameDisplay: username,
    role,
    passwordHash: await User.hashPassword(password)
  });
  const agent = request.agent(app);
  await agent.post('/api/v2/auth/login').send({ username, password }).expect(200);
  return agent;
}

describe('v2 guide API', () => {
  beforeAll(async () => {
    uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gsplay-guide-test-'));
    const config = loadEnvironment({
      NODE_ENV: 'test',
      MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      GUIDE_UPLOAD_DIR: uploadDir,
      GUIDE_IMAGE_MAX_BYTES: '1024'
    });
    app = createApp(config);
  });
  beforeEach(async () => {
    await global.testUtils.cleanupDatabase();
    const files = await fs.readdir(uploadDir);
    await Promise.all(files.map((file) => fs.unlink(path.join(uploadDir, file))));
  });
  afterAll(() => fs.rm(uploadDir, { recursive: true, force: true }));

  test('requires authentication and returns an empty guide before its first save', async () => {
    await request(app).get('/api/v2/guide').expect(401);
    const member = await authenticatedAgent('Guide Member');
    const response = await member.get('/api/v2/guide').expect(200);
    expect(response.body.guide).toEqual({ markdown: '', updatedAt: null });
  });

  test('lets only admins save the singleton guide and immediately exposes the update', async () => {
    const member = await authenticatedAgent('Regular Reader');
    await member.put('/api/v2/guide').send({ markdown: '# Nope' }).expect(403);
    const admin = await authenticatedAgent('Guide Admin', 'admin');
    const first = await admin
      .put('/api/v2/guide')
      .send({ markdown: '# Benvenuti\n\nUsate **GSPlay**.' })
      .expect(200);
    expect(first.body.guide).toMatchObject({ markdown: '# Benvenuti\n\nUsate **GSPlay**.' });
    expect(first.body.guide.updatedAt).toBeTruthy();
    const second = await admin
      .put('/api/v2/guide')
      .send({ markdown: '# Guida aggiornata' })
      .expect(200);
    expect(second.body.guide.markdown).toBe('# Guida aggiornata');
    expect(await Guide.countDocuments()).toBe(1);
    await member
      .get('/api/v2/guide')
      .expect(200)
      .expect((response) => expect(response.body.guide.markdown).toBe('# Guida aggiornata'));
  });

  test('validates the update body and permits an intentionally empty guide', async () => {
    const admin = await authenticatedAgent('Validating Admin', 'admin');
    await admin.put('/api/v2/guide').send({ markdown: 42 }).expect(400);
    await admin.put('/api/v2/guide').send({ markdown: '', extra: true }).expect(400);
    await admin
      .put('/api/v2/guide')
      .send({ markdown: 'x'.repeat(100_001) })
      .expect(400);
    await admin.put('/api/v2/guide').send({ markdown: '' }).expect(200);
  });

  test('lets only admins upload detected image data under a random stable URL', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    await request(app)
      .post('/api/v2/guide/images')
      .attach('image', png, { filename: 'pixel.png', contentType: 'image/png' })
      .expect(401);
    const member = await authenticatedAgent('Image Reader');
    await member
      .post('/api/v2/guide/images')
      .attach('image', png, { filename: 'pixel.png', contentType: 'image/png' })
      .expect(403);
    const admin = await authenticatedAgent('Image Admin', 'admin');
    const response = await admin
      .post('/api/v2/guide/images')
      .attach('image', png, { filename: 'not-trusted.txt', contentType: 'text/plain' })
      .expect(201);
    expect(response.body).toMatchObject({ mimeType: 'image/png', size: png.length });
    expect(response.body.url).toMatch(/^\/uploads\/guide\/[0-9a-f-]+\.png$/);
    expect(await fs.readFile(path.join(uploadDir, path.basename(response.body.url)))).toEqual(png);
    await request(app)
      .get(response.body.url)
      .expect(200)
      .expect('content-type', /image\/png/)
      .expect('cache-control', /immutable/);
  });

  test('detects every supported image signature without trusting names or MIME headers', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff]))).toEqual({
      extension: 'jpg',
      mimeType: 'image/jpeg'
    });
    expect(detectImageType(Buffer.from('GIF89a'))).toEqual({
      extension: 'gif',
      mimeType: 'image/gif'
    });
    expect(detectImageType(Buffer.from('RIFF0000WEBP'))).toEqual({
      extension: 'webp',
      mimeType: 'image/webp'
    });
    expect(detectImageType(Buffer.from('not an image'))).toBeNull();
  });

  test('rejects unsupported, missing, and oversized guide image uploads', async () => {
    const admin = await authenticatedAgent('Strict Image Admin', 'admin');
    await admin.post('/api/v2/guide/images').expect(400);
    await admin
      .post('/api/v2/guide/images')
      .attach('image', Buffer.from('<svg><script>alert(1)</script></svg>'), {
        filename: 'attack.png',
        contentType: 'image/png'
      })
      .expect(415);
    await admin
      .post('/api/v2/guide/images')
      .attach('image', Buffer.alloc(1025, 0x41), {
        filename: 'large.png',
        contentType: 'image/png'
      })
      .expect(413);
    expect(await fs.readdir(uploadDir)).toHaveLength(0);
  });
});
