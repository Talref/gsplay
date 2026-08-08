const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const Guide = require('../../src/v2/models/Guide');
const User = require('../../src/v2/models/User');

const config = loadEnvironment({
  NODE_ENV: 'test',
  MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32)
});
const app = createApp(config);
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
  beforeEach(() => global.testUtils.cleanupDatabase());

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
});
