const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const User = require('../../src/v2/models/User');
const RetroChallenge = require('../../src/v2/models/RetroChallenge');

const config = loadEnvironment({ NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test', JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32) });
const password = 'correct-horse-battery-staple';

describe('v2 RetroAchievements API', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());
  test('links a strict account name and fetches only the caller profile', async () => {
    const retroClient = { getProfile: jest.fn().mockResolvedValue({ user: 'AquaPlayer', totalPoints: 1234, userPic: 'https://example.test/avatar.png' }) };
    const app = createApp(config, { retroClient });
    await User.create({ usernameNormalized: 'retro user', usernameDisplay: 'Retro User', passwordHash: await User.hashPassword(password) });
    const agent = request.agent(app); await agent.post('/api/v2/auth/login').send({ username: 'Retro User', password }).expect(200);
    await agent.put('/api/v2/me/retroachievements').send({ username: 'AquaPlayer' }).expect(200);
    const response = await agent.get('/api/v2/me/retroachievements/profile').expect(200);
    expect(response.body.profile).toMatchObject({ username: 'AquaPlayer', points: 1234 });
    expect(retroClient.getProfile).toHaveBeenCalledWith('AquaPlayer');
    await agent.put('/api/v2/me/retroachievements').send({ username: '<script>' }).expect(400);
  });

  test('lets an admin activate one challenge and gives linked members their own progress DTO', async () => {
    const retroClient = { getProfile: jest.fn(), getGame: jest.fn().mockResolvedValue({ title: 'Aqua Quest', consoleName: 'SNES', imageBoxArt: 'https://example.test/aqua.png' }), getGameProgress: jest.fn().mockResolvedValue({ numAwardedToUser: 3, numAchievements: 12, pointsEarned: 25 }) };
    const app = createApp(config, { retroClient });
    const admin = await User.create({ usernameNormalized: 'retro admin', usernameDisplay: 'Retro Admin', passwordHash: await User.hashPassword(password), role: 'admin' });
    await User.create({ usernameNormalized: 'retro member', usernameDisplay: 'Retro Member', passwordHash: await User.hashPassword(password), retroAchievements: { username: 'AquaPlayer', linkedAt: new Date() } });
    const adminAgent = request.agent(app); await adminAgent.post('/api/v2/auth/login').send({ username: 'Retro Admin', password }).expect(200);
    const created = await adminAgent.put('/api/v2/admin/retroachievements/challenge').send({ retroGameId: 123, description: 'June challenge' }).expect(200);
    expect(created.body.challenge).toMatchObject({ retroGameId: 123, title: 'Aqua Quest', active: true });
    expect(await RetroChallenge.countDocuments({ active: true })).toBe(1);
    const memberAgent = request.agent(app); await memberAgent.post('/api/v2/auth/login').send({ username: 'Retro Member', password }).expect(200);
    const response = await memberAgent.get('/api/v2/retroachievements/challenge').expect(200);
    expect(response.body.challenge).toMatchObject({ title: 'Aqua Quest', progress: { earned: 3, total: 12, points: 25 } });
    expect(retroClient.getGameProgress).toHaveBeenCalledWith(123, 'AquaPlayer');
    await request.agent(app).put('/api/v2/admin/retroachievements/challenge').send({ retroGameId: 321 }).expect(401);
    expect(admin._id).toBeDefined();
  });
});