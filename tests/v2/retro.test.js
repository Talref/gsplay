const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const User = require('../../src/v2/models/User');
const RetroChallenge = require('../../src/v2/models/RetroChallenge');
const RetroProgress = require('../../src/v2/models/RetroChallengeProgress');
const { monthWindow, refreshChallenge } = require('../../src/v2/services/retroService');
const { backfillRetroChallenges } = require('../../src/v2/services/retroCompatibility');

const config = loadEnvironment({
  NODE_ENV: 'test',
  MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32)
});
const password = 'correct-horse-battery-staple';
const game = {
  title: 'Aqua Quest',
  consoleName: 'SNES',
  imageBoxArt: '/Images/aqua.png',
  achievements: {
    10: { id: 10, badgeName: 'badge10', title: 'First', description: 'First trophy', points: 5, displayOrder: 1 },
    20: { id: 20, badgeName: 'badge20', title: 'Second', description: 'Second trophy', points: 10, displayOrder: 2 }
  }
};

async function user(values) {
  return User.create({
    usernameNormalized: values.usernameDisplay.toLowerCase(),
    passwordHash: await User.hashPassword(password),
    ...values
  });
}

async function login(app, username) {
  const agent = request.agent(app);
  await agent.post('/api/v2/auth/login').send({ username, password }).expect(200);
  return agent;
}

describe('v2 Retroclub API', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('verifies and stores the stable provider identity while linking an account', async () => {
    const retroClient = {
      getProfile: jest.fn().mockResolvedValue({
        User: 'AquaPlayer',
        ID: 4321,
        TotalPoints: 1234,
        UserPic: '/UserPic/aqua.png'
      })
    };
    const app = createApp(config, { retroClient });
    await user({ usernameDisplay: 'Retro User' });
    const agent = await login(app, 'Retro User');
    const response = await agent
      .put('/api/v2/me/retroachievements')
      .send({ username: 'AquaPlayer' })
      .expect(200);
    expect(response.body.retroAchievements).toMatchObject({ username: 'AquaPlayer', userId: '4321' });
    expect((await User.findOne({ usernameNormalized: 'retro user' })).retroAchievements.userId).toBe('4321');
    expect(retroClient.getProfile).toHaveBeenCalledWith('AquaPlayer');
    await agent.put('/api/v2/me/retroachievements').send({ username: '<script>' }).expect(400);
  });

  test('prevents one RetroAchievements identity from being linked twice', async () => {
    const retroClient = { getProfile: jest.fn().mockResolvedValue({ User: 'AquaPlayer', ID: 4321 }) };
    const app = createApp(config, { retroClient });
    await user({ usernameDisplay: 'First User', retroAchievements: { username: 'AquaPlayer', userId: '4321', linkedAt: new Date() } });
    await user({ usernameDisplay: 'Second User' });
    const agent = await login(app, 'Second User');
    await agent.put('/api/v2/me/retroachievements').send({ username: 'AquaPlayer' }).expect(409);
  });

  test('supports preview, activation, refresh, cancellation, and a replacement in one month', async () => {
    const retroClient = {
      getGame: jest.fn().mockResolvedValue(game),
      getAchievementsBetween: jest.fn().mockResolvedValue([
        { gameId: 123, achievementId: 10, date: '2026-08-02 10:00:00', hardcoreMode: false },
        { gameId: 123, achievementId: 10, date: '2026-08-03 10:00:00', hardcoreMode: true },
        { gameId: 999, achievementId: 20, date: '2026-08-04 10:00:00', hardcoreMode: true }
      ])
    };
    const app = createApp(config, { retroClient });
    await user({ usernameDisplay: 'Retro Admin', role: 'admin' });
    await user({ usernameDisplay: 'Retro Member', retroAchievements: { username: 'AquaPlayer', userId: '4321', linkedAt: new Date() } });
    const admin = await login(app, 'Retro Admin');

    const preview = await admin.post('/api/v2/admin/retroachievements/preview').send({ game: 'https://retroachievements.org/game/123' }).expect(200);
    expect(preview.body.game).toMatchObject({ retroGameId: 123, achievementCount: 2 });
    const created = await admin.post('/api/v2/admin/retroachievements/challenges').send({ game: '123', description: 'Monthly run' }).expect(201);
    expect(created.body.challenge).toMatchObject({ retroGameId: 123, status: 'active', sequence: 1 });

    await admin.post(`/api/v2/admin/retroachievements/challenges/${created.body.challenge.id}/refresh`).send({}).expect(200);
    const publicResponse = await admin.get('/api/v2/retroachievements').expect(200);
    expect(publicResponse.body.active.leaderboard[0]).toMatchObject({ username: 'Retro Member', score: 5, unlockedCount: 1, hardcoreCount: 1, completionPercentage: 50 });
    expect(publicResponse.body.active.achievements[0].playerCount).toBe(1);
    const call = retroClient.getAchievementsBetween.mock.calls[0];
    expect(call[0]).toBe('AquaPlayer');
    expect(call[1]).toEqual(monthWindow().startsAt);

    const active = publicResponse.body.active;
    await admin.post(`/api/v2/admin/retroachievements/challenges/${active.id}/cancel`).send({ version: active.version, reason: 'Wrong game' }).expect(200);
    await admin.post('/api/v2/admin/retroachievements/challenges').send({ game: '123', description: '' }).expect(201);
    expect(await RetroChallenge.countDocuments()).toBe(2);
    expect(await RetroChallenge.countDocuments({ status: 'cancelled' })).toBe(1);
    expect((await RetroChallenge.findOne({ active: true })).sequence).toBe(2);
  });

  test('ranks exact scoring ties jointly', async () => {
    const window = monthWindow(new Date('2026-08-15T12:00:00Z'));
    const admin = await user({ usernameDisplay: 'Admin User', role: 'admin' });
    const first = await user({ usernameDisplay: 'First Player', retroAchievements: { username: 'FirstRA', userId: '1', linkedAt: new Date() } });
    const second = await user({ usernameDisplay: 'Second Player', retroAchievements: { username: 'SecondRA', userId: '2', linkedAt: new Date() } });
    const challenge = await RetroChallenge.create({ retroGameId: 123, monthKey: window.monthKey, sequence: 1, status: 'active', active: true, title: game.title, achievements: Object.values(game.achievements).map((item) => ({ achievementId: item.id, badgeId: item.badgeName, title: item.title, description: item.description, points: item.points, displayOrder: item.displayOrder })), scoringStartsAt: window.startsAt, scoringEndsAt: window.endsAt, activatedBy: admin._id });
    const client = { getAchievementsBetween: jest.fn().mockResolvedValue([{ gameId: 123, achievementId: 10, date: '2026-08-02 10:00:00', hardcoreMode: true }]) };
    await refreshChallenge(challenge, client, new Date('2026-08-15T12:00:00Z'));
    const progress = await RetroProgress.find({ userId: { $in: [first._id, second._id] } }).sort({ usernameSnapshot: 1 });
    expect(progress).toHaveLength(2);
    const app = createApp(config, { retroClient: client });
    const agent = await login(app, 'Admin User');
    const response = await agent.get('/api/v2/retroachievements').expect(200);
    expect(response.body.active.leaderboard.map((entry) => entry.rank)).toEqual([1, 1]);
  });

  test('backfills legacy challenge lifecycle fields without replacing its collection row', async () => {
    const actor = await user({ usernameDisplay: 'Legacy Admin', role: 'admin' });
    const createdAt = new Date('2026-07-12T12:00:00Z');
    const { insertedId } = await RetroChallenge.collection.insertOne({
      retroGameId: 456,
      title: 'Legacy Quest',
      active: true,
      activatedBy: actor._id,
      createdAt,
      updatedAt: createdAt
    });
    expect(await backfillRetroChallenges()).toBe(1);
    const challenge = await RetroChallenge.findById(insertedId);
    expect(challenge).toMatchObject({
      monthKey: '2026-07',
      sequence: 1,
      version: 1,
      status: 'active',
      active: true
    });
    expect(challenge.scoringStartsAt).toEqual(monthWindow(createdAt).startsAt);
    expect(challenge.scoringEndsAt).toEqual(monthWindow(createdAt).endsAt);
  });
});
