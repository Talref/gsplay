const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const User = require('../../src/v2/models/User');
const LibraryItem = require('../../src/v2/models/LibraryItem');
const CanonicalGame = require('../../src/v2/models/CanonicalGame');
const RefreshSession = require('../../src/v2/models/RefreshSession');
const SyncJob = require('../../src/v2/models/SyncJob');
const GameAlias = require('../../src/v2/models/GameAlias');
const AdminUserAction = require('../../src/v2/models/AdminUserAction');
const MostWantedSnapshot = require('../../src/v2/models/MostWantedSnapshot');

const config = loadEnvironment({
  NODE_ENV: 'test',
  MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32)
});
const app = createApp(config);
const password = 'correct-horse-battery-staple';
async function createUser(username, role = 'member', extras = {}) {
  return User.create({
    usernameNormalized: username.toLowerCase(),
    usernameDisplay: username,
    role,
    passwordHash: await User.hashPassword(password),
    ...extras
  });
}
async function adminAgent() {
  const admin = await createUser('Steward', 'admin');
  const agent = request.agent(app);
  await agent.post('/api/v2/auth/login').send({ username: 'Steward', password }).expect(200);
  return { admin, agent };
}

describe('v2 admin user management', () => {
  beforeEach(() => global.testUtils.cleanupDatabase());

  test('lets only admins search users and promote or demote helpers without leaking provider IDs', async () => {
    const { agent } = await adminAgent();
    const subject = await createUser('HelpfulMod', 'member', {
      steamAccount: { steamId: '76561198000000000' }
    });
    await agent.get('/api/v2/admin/users?q=he').expect(400);
    const listed = await agent.get('/api/v2/admin/users?q=hel').expect(200);
    expect(listed.body.users).toEqual([
      expect.objectContaining({
        id: subject._id.toString(),
        username: 'HelpfulMod',
        role: 'member',
        hasSteamAccount: true
      })
    ]);
    expect(JSON.stringify(listed.body)).not.toContain('76561198000000000');
    await agent
      .put(`/api/v2/admin/users/${subject._id}/role`)
      .send({ role: 'helper' })
      .expect(200)
      .expect((response) => expect(response.body.user.role).toBe('helper'));
    expect(await User.findById(subject._id)).toMatchObject({ role: 'helper' });
    expect(
      await AdminUserAction.findOne({
        subjectUserId: subject._id,
        kind: 'role_changed',
        beforeRole: 'member',
        afterRole: 'helper'
      })
    ).toBeTruthy();
    await agent.put(`/api/v2/admin/users/${subject._id}/role`).send({ role: 'admin' }).expect(400);
    const member = await createUser('RegularMember');
    const memberAgent = request.agent(app);
    await memberAgent
      .post('/api/v2/auth/login')
      .send({ username: member.usernameDisplay, password })
      .expect(200);
    await memberAgent.get('/api/v2/admin/users?q=hel').expect(403);
  });

  test('reports account and Steam coverage only to admins', async () => {
    const { agent } = await adminAgent();
    const [available, unavailable] = await Promise.all([
      createUser('PublicWishlist', 'member', {
        steamAccount: {
          steamId: '76561198000000001',
          lastSyncedAt: new Date('2026-08-15T12:00:00.000Z')
        }
      }),
      createUser('PrivateWishlist', 'member', {
        steamAccount: { steamId: '76561198000000002' }
      }),
      createUser('NoSteam')
    ]);
    await MostWantedSnapshot.create({
      key: 'current',
      lastAttemptAt: new Date('2026-08-16T12:00:00.000Z'),
      profileDiagnostics: [
        {
          userId: available._id,
          steamId: available.steamAccount.steamId,
          outcome: 'accessible',
          itemCount: 12,
          checkedAt: new Date('2026-08-16T12:00:00.000Z')
        },
        {
          userId: unavailable._id,
          steamId: unavailable.steamAccount.steamId,
          outcome: 'unavailable',
          itemCount: 0,
          libraryAccessible: false,
          errorCode: 'steam_game_details_unavailable',
          checkedAt: new Date('2026-08-16T12:00:00.000Z')
        }
      ]
    });

    const response = await agent.get('/api/v2/admin/account-coverage').expect(200);
    expect(response.body).toMatchObject({
      totalUsers: 4,
      steam: {
        linked: 2,
        librariesVerified: 1,
        wishlistsWithGames: 1,
        emptyWishlists: 0,
        unavailableWishlists: 1,
        cachedWishlists: 0,
        unchecked: 0
      },
      attention: [
        expect.objectContaining({
          username: 'PrivateWishlist',
          steamId: '76561198000000002',
          errorCode: 'steam_game_details_unavailable'
        })
      ]
    });
    const member = await createUser('CoverageDenied');
    const memberAgent = request.agent(app);
    await memberAgent
      .post('/api/v2/auth/login')
      .send({ username: member.usernameDisplay, password })
      .expect(200);
    await memberAgent.get('/api/v2/admin/account-coverage').expect(403);
  });

  test('deletes private account records, protects admins, retains shared metadata history, and hides unaliased orphaned provider games', async () => {
    const { admin, agent } = await adminAgent();
    const subject = await createUser('DepartingMember');
    const orphan = await CanonicalGame.create({
      canonicalTitle: 'Lonely Provider Game',
      normalizedTitle: 'lonelyprovidergame'
    });
    const retained = await CanonicalGame.create({
      canonicalTitle: 'Aliased Game',
      normalizedTitle: 'aliasedgame'
    });
    await LibraryItem.create([
      {
        userId: subject._id,
        provider: 'steam',
        providerGameId: 'orphan',
        providerTitle: orphan.canonicalTitle,
        normalizedTitle: orphan.normalizedTitle,
        canonicalGameId: orphan._id,
        matchStatus: 'auto_matched',
        source: 'api'
      },
      {
        userId: subject._id,
        provider: 'steam',
        providerGameId: 'aliased',
        providerTitle: retained.canonicalTitle,
        normalizedTitle: retained.normalizedTitle,
        canonicalGameId: retained._id,
        matchStatus: 'auto_matched',
        source: 'api'
      }
    ]);
    await GameAlias.create({
      provider: 'steam',
      providerGameId: 'aliased',
      normalizedProviderTitle: retained.normalizedTitle,
      canonicalGameId: retained._id,
      matchType: 'manual',
      confidence: 1,
      reviewedBy: subject._id
    });
    await RefreshSession.create({
      userId: subject._id,
      tokenHash: 'c'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000)
    });
    await SyncJob.create({
      userId: subject._id,
      provider: 'steam',
      kind: 'provider_sync',
      idempotencyKey: 'delete-user-running-job',
      status: 'queued'
    });
    orphan.metadataReviewedBy = subject._id;
    await orphan.save();
    await agent
      .delete(`/api/v2/admin/users/${subject._id}`)
      .send({ confirmation: 'wrong', reason: 'Left Discord' })
      .expect(400);
    const response = await agent
      .delete(`/api/v2/admin/users/${subject._id}`)
      .send({ confirmation: 'DELETE DepartingMember', reason: 'Left Discord' })
      .expect(200);
    expect(response.body.deleted).toMatchObject({
      username: 'DepartingMember',
      deletedLibraryItems: 2,
      revokedSessions: 1,
      cancelledJobs: 1,
      hiddenOrphans: [{ id: orphan._id.toString(), title: orphan.canonicalTitle }]
    });
    expect(await User.findById(subject._id)).toBeNull();
    expect(await LibraryItem.countDocuments({ userId: subject._id })).toBe(0);
    expect(await RefreshSession.countDocuments({ userId: subject._id })).toBe(0);
    expect(await SyncJob.findOne({ idempotencyKey: 'delete-user-running-job' })).toMatchObject({
      status: 'failed'
    });
    expect(await CanonicalGame.findById(orphan._id)).toMatchObject({
      hiddenBy: admin._id,
      metadataReviewedBy: null
    });
    expect(await CanonicalGame.findById(retained._id)).toMatchObject({ hiddenAt: null });
    expect(await GameAlias.findOne({ providerGameId: 'aliased' })).toMatchObject({
      reviewedBy: null
    });
    expect(
      await AdminUserAction.findOne({
        subjectUserId: subject._id,
        kind: 'user_deleted',
        reason: 'Left Discord'
      })
    ).toBeTruthy();
    await agent
      .delete(`/api/v2/admin/users/${admin._id}`)
      .send({ confirmation: 'DELETE Steward', reason: 'bad' })
      .expect(409);
  });
});
