const CanonicalGame = require('../../src/v2/models/CanonicalGame');
const GameAlias = require('../../src/v2/models/GameAlias');
const LibraryItem = require('../../src/v2/models/LibraryItem');
const MostWantedSnapshot = require('../../src/v2/models/MostWantedSnapshot');
const SyncJob = require('../../src/v2/models/SyncJob');
const User = require('../../src/v2/models/User');
const {
  AGGREGATION_VERSION,
  refreshMostWanted,
  refreshMostWantedIfDue
} = require('../../src/v2/services/mostWantedService');

const passwordHash = '$2b$12$5D9JY27wNWzuO2AAq1/3wu1qA9c3DU7xGCZ3WO3dJzI9PL/5R7TnW';
async function user(username, steamId) {
  return User.create({
    usernameNormalized: User.normalizeUsername(username),
    usernameDisplay: username,
    passwordHash,
    ...(steamId ? { steamAccount: { steamId } } : {})
  });
}
async function game(title) {
  return CanonicalGame.create({ canonicalTitle: title, normalizedTitle: title.toLowerCase() });
}

describe('Most Wanted aggregation', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('aggregates unique wishlist users, catalogue aliases, ownership, and coverage', async () => {
    const linkedUsers = await Promise.all([
      user('Aurelia', '76561198000000001'),
      user('Brutus', '76561198000000002'),
      user('Cassia', '76561198000000003'),
      user('Domitia')
    ]);
    const owner = linkedUsers[3];
    const [popular, niche] = await Promise.all([game('Popular Game'), game('Niche Game')]);
    await GameAlias.create({
      provider: 'steam',
      providerGameId: '10',
      normalizedProviderTitle: 'popular game',
      canonicalGameId: popular._id,
      matchType: 'provider_id',
      confidence: 1
    });
    await LibraryItem.create([
      {
        userId: owner._id,
        provider: 'gog',
        providerGameId: 'popular-gog',
        providerTitle: 'Popular Game',
        normalizedTitle: 'popular game',
        canonicalGameId: popular._id,
        matchStatus: 'auto_matched',
        source: 'upload'
      },
      {
        userId: owner._id,
        provider: 'manual',
        providerGameId: popular._id.toString(),
        providerTitle: 'Popular Game',
        normalizedTitle: 'popular game',
        canonicalGameId: popular._id,
        matchStatus: 'manually_matched',
        source: 'manual'
      },
      {
        userId: linkedUsers[1]._id,
        provider: 'steam',
        providerGameId: '20',
        providerTitle: 'Niche Game',
        normalizedTitle: 'niche game',
        canonicalGameId: niche._id,
        matchStatus: 'auto_matched',
        source: 'api'
      }
    ]);
    const steamClient = {
      listWishlist: jest.fn(async (steamId) => {
        if (steamId.endsWith('1')) return ['10', '10', '999'];
        if (steamId.endsWith('2')) return ['10', '20'];
        throw Object.assign(new Error('Private'), { code: 'steam_wishlist_unavailable' });
      })
    };
    const now = new Date('2026-08-16T12:00:00.000Z');
    await expect(refreshMostWanted({ steamClient, now, log: { warn: jest.fn() } })).resolves.toEqual(
      {
        updated: true,
        profilesEligible: 3,
        profilesIncluded: 2,
        profilesCached: 0,
        games: 2,
        unmatchedAppCount: 1
      }
    );
    const snapshot = await MostWantedSnapshot.findOne({ key: 'current' }).lean();
    expect(snapshot).toMatchObject({
      generatedAt: now,
      profilesEligible: 3,
      profilesIncluded: 2,
      profilesUnavailable: 1,
      profilesCached: 0,
      unmatchedAppCount: 1
    });
    expect(snapshot.games.map((entry) => entry.title)).toEqual(['Popular Game', 'Niche Game']);
    expect(snapshot.games[0]).toMatchObject({ wishlistCount: 2, ownerCount: 1 });
    expect(snapshot.games[0].wishlistedBy.map((entry) => entry.username)).toEqual([
      'Aurelia',
      'Brutus'
    ]);
    expect(snapshot.games[0].ownedBy.map((entry) => entry.username)).toEqual(['Domitia']);
  });

  test('preserves the previous valid snapshot when no linked profile is accessible', async () => {
    await user('Private User', '76561198000000001');
    const existingTime = new Date('2026-08-15T12:00:00.000Z');
    await MostWantedSnapshot.create({
      key: 'current',
      generatedAt: existingTime,
      lastAttemptAt: existingTime,
      profilesEligible: 1,
      profilesIncluded: 1,
      games: []
    });
    const attemptedAt = new Date('2026-08-16T12:00:00.000Z');
    await expect(
      refreshMostWanted({
        steamClient: { listWishlist: jest.fn().mockRejectedValue(new Error('Unavailable')) },
        now: attemptedAt,
        log: { warn: jest.fn() }
      })
    ).resolves.toMatchObject({ updated: false, profilesEligible: 1, profilesIncluded: 0 });
    const snapshot = await MostWantedSnapshot.findOne({ key: 'current' }).lean();
    expect(snapshot.generatedAt).toEqual(existingTime);
    expect(snapshot.lastAttemptAt).toEqual(attemptedAt);
    expect(snapshot.lastError.code).toBe('no_accessible_profiles');
  });

  test('reuses a profile cache for transient errors when another profile refreshes successfully', async () => {
    const [cachedUser, freshUser] = await Promise.all([
      user('Cached User', '76561198000000001'),
      user('Fresh User', '76561198000000002')
    ]);
    const wanted = await game('Resilient Game');
    await GameAlias.create({
      provider: 'steam',
      providerGameId: '10',
      normalizedProviderTitle: 'resilient game',
      canonicalGameId: wanted._id,
      matchType: 'provider_id',
      confidence: 1
    });
    await MostWantedSnapshot.create({
      key: 'current',
      generatedAt: new Date('2026-08-15T12:00:00.000Z'),
      profileCaches: [
        {
          userId: cachedUser._id,
          steamId: cachedUser.steamAccount.steamId,
          appIds: ['10'],
          fetchedAt: new Date('2026-08-15T12:00:00.000Z')
        }
      ]
    });
    const steamClient = {
      listWishlist: jest.fn(async (steamId) => {
        if (steamId === freshUser.steamAccount.steamId) return ['10'];
        throw Object.assign(new Error('Rate limited'), { retryable: true, code: 'steam_rate_limited' });
      })
    };
    await expect(
      refreshMostWanted({
        steamClient,
        now: new Date('2026-08-16T12:00:00.000Z'),
        log: { warn: jest.fn() }
      })
    ).resolves.toMatchObject({ updated: true, profilesIncluded: 2, profilesCached: 1, games: 1 });
    const snapshot = await MostWantedSnapshot.findOne({ key: 'current' }).lean();
    expect(snapshot.games[0]).toMatchObject({ title: 'Resilient Game', wishlistCount: 2 });
    expect(snapshot.profilesCached).toBe(1);
  });

  test('classifies ambiguous responses using current game-details privacy', async () => {
    const linked = await Promise.all([
      user('Empty Public', '76561198000000001'),
      user('Has Wishes', '76561198000000002'),
      user('Private Profile', '76561198000000003')
    ]);
    const wanted = await game('Wanted Game');
    await GameAlias.create({
      provider: 'steam',
      providerGameId: '10',
      normalizedProviderTitle: 'wanted game',
      canonicalGameId: wanted._id,
      matchType: 'provider_id',
      confidence: 1
    });
    const steamClient = {
      inspectWishlist: jest.fn(async (steamId) =>
        steamId.endsWith('2')
          ? { outcome: 'accessible', appIds: ['10'] }
          : { outcome: 'ambiguous', appIds: [] }
      ),
      probeGameDetails: jest.fn(async (steamId) => steamId.endsWith('1'))
    };
    const now = new Date('2026-08-16T12:00:00.000Z');

    await expect(refreshMostWanted({ steamClient, now, log: { warn: jest.fn() } })).resolves.toEqual(
      {
        updated: true,
        profilesEligible: 3,
        profilesIncluded: 2,
        profilesCached: 0,
        games: 1,
        unmatchedAppCount: 0
      }
    );
    const snapshot = await MostWantedSnapshot.findOne({ key: 'current' }).lean();
    expect(snapshot.profileDiagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: linked[0]._id, outcome: 'empty', itemCount: 0 }),
        expect.objectContaining({ userId: linked[1]._id, outcome: 'accessible', itemCount: 1 }),
        expect.objectContaining({
          userId: linked[2]._id,
          outcome: 'unavailable',
          errorCode: 'steam_game_details_unavailable'
        })
      ])
    );
  });

  test('discovers unowned wishlist games, reuses exact catalogue titles, and queues enrichment', async () => {
    await user('Aurelia', '76561198000000001');
    const existing = await game('Known Upcoming Game');
    existing.metadata.status = 'complete';
    await existing.save();
    const listAppNames = jest.fn().mockResolvedValue([
      { providerGameId: '30', providerTitle: 'Known Upcoming Game' },
      { providerGameId: '40', providerTitle: 'Brand New Game' }
    ]);
    const steamClient = {
      listWishlist: jest.fn().mockResolvedValue(['30', '40']),
      listAppNames
    };
    const now = new Date('2026-08-16T12:00:00.000Z');

    await expect(refreshMostWanted({ steamClient, now })).resolves.toMatchObject({
      updated: true,
      games: 2,
      unmatchedAppCount: 0
    });
    const discovered = await CanonicalGame.findOne({ normalizedTitle: 'brand new game' });
    expect(discovered).toMatchObject({
      canonicalTitle: 'Brand New Game',
      origin: 'provider_discovery'
    });
    expect(discovered.artwork).toBeUndefined();
    expect(await GameAlias.countDocuments({ provider: 'steam' })).toBe(2);
    expect(
      await SyncJob.exists({
        provider: 'igdb',
        kind: 'metadata_enrichment',
        'payload.canonicalGameId': discovered._id.toString()
      })
    ).toBeTruthy();

    await refreshMostWanted({ steamClient, now: new Date(now.getTime() + 60_000) });
    expect(listAppNames).toHaveBeenCalledTimes(1);
  });

  test('skips refreshes until the configured interval has elapsed', async () => {
    const now = new Date('2026-08-16T12:00:00.000Z');
    await MostWantedSnapshot.create({
      key: 'current',
      aggregationVersion: AGGREGATION_VERSION,
      generatedAt: now,
      lastAttemptAt: now
    });
    const steamClient = { listWishlist: jest.fn() };
    await expect(
      refreshMostWantedIfDue({
        config: { mostWanted: { refreshMs: 86_400_000 } },
        steamClient,
        now: new Date(now.getTime() + 60_000)
      })
    ).resolves.toEqual({ due: false });
    expect(steamClient.listWishlist).not.toHaveBeenCalled();
  });

  test('refreshes immediately when the stored aggregation version is obsolete', async () => {
    const now = new Date('2026-08-16T12:00:00.000Z');
    await MostWantedSnapshot.collection.insertOne({
      key: 'current',
      aggregationVersion: AGGREGATION_VERSION - 1,
      generatedAt: now,
      lastAttemptAt: now,
      games: [],
      profileCaches: []
    });
    await expect(
      refreshMostWantedIfDue({
        config: { mostWanted: { refreshMs: 86_400_000 } },
        steamClient: { listWishlist: jest.fn() },
        now
      })
    ).resolves.toMatchObject({ due: true, updated: true });
    expect((await MostWantedSnapshot.findOne({ key: 'current' })).aggregationVersion).toBe(
      AGGREGATION_VERSION
    );
  });
});
