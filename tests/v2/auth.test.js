const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const User = require('../../src/v2/models/User');
const RefreshSession = require('../../src/v2/models/RefreshSession');

const config = loadEnvironment({
  NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
  JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '1d'
});
const app = createApp(config);

describe('v2 authentication API', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('reports liveness and database-backed readiness', async () => {
    await request(app).get('/health/live').expect(200, { status: 'ok' });
    await request(app).get('/health/ready').expect(200, { status: 'ready' });
  });

  test('signup always creates a member and authenticates the session', async () => {
    const agent = request.agent(app);
    const signup = await agent.post('/api/v2/auth/signup').send({ username: '  Player One ', password: 'correct-horse-battery-staple', role: 'admin' }).expect(400);
    expect(signup.body.error.code).toBe('invalid_request');
    const response = await agent.post('/api/v2/auth/signup').send({ username: '  Player One ', password: 'correct-horse-battery-staple' }).expect(201);
    expect(response.body.user).toMatchObject({ username: 'Player One', role: 'member' });
    expect(response.body.user.passwordHash).toBeUndefined();
    const me = await agent.get('/api/v2/me').expect(200);
    expect(me.body.user).toMatchObject({ username: 'Player One', role: 'member' });
    expect(await User.findOne({ usernameNormalized: 'player one' })).toBeTruthy();
  });

  test('rotates the refresh session and revokes it on logout', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v2/auth/signup').send({ username: 'Session Player', password: 'correct-horse-battery-staple' }).expect(201);
    const initial = await RefreshSession.findOne();
    await agent.post('/api/v2/auth/refresh').expect(200);
    expect((await RefreshSession.findById(initial._id)).revokedAt).toBeTruthy();
    await agent.post('/api/v2/auth/logout').expect(204);
    await agent.post('/api/v2/auth/refresh').expect(401);
  });

  test('rejects an invalid login without issuing a session', async () => {
    await User.create({ usernameNormalized: 'member', usernameDisplay: 'Member', passwordHash: await User.hashPassword('correct-horse-battery-staple') });
    const response = await request(app).post('/api/v2/auth/login').send({ username: 'member', password: 'wrong-password' }).expect(401);
    expect(response.body.error.code).toBe('invalid_credentials');
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});