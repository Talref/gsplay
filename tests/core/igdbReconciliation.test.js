const CanonicalGame = require('../../src/core/models/CanonicalGame');
const SyncJob = require('../../src/core/models/SyncJob');
const { reconcileIgdbMetadata } = require('../../src/core/jobs/igdbReconciliation');

describe('IGDB reconciliation', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('requeues bounded pending metadata and reclaims expired IGDB leases', async () => {
    const first = await CanonicalGame.create({ canonicalTitle: 'One', normalizedTitle: 'one' });
    await CanonicalGame.create({ canonicalTitle: 'Two', normalizedTitle: 'two' });
    await SyncJob.create({
      provider: 'igdb',
      kind: 'metadata_enrichment',
      status: 'running',
      idempotencyKey: 'expired-lease',
      payload: { canonicalGameId: first._id.toString() },
      leaseExpiresAt: new Date(0)
    });
    const config = {
      providers: { igdbClientId: 'client', igdbClientSecret: 'secret' },
      igdb: { queueLimit: 1 }
    };
    const report = await reconcileIgdbMetadata({ config, log: { info: jest.fn() } });
    expect(report.staleLeases).toBe(1);
    expect(report.queued).toBeLessThanOrEqual(1);
    expect(
      await SyncJob.countDocuments({
        provider: 'igdb',
        kind: 'metadata_enrichment',
        status: 'queued'
      })
    ).toBeGreaterThanOrEqual(1);
    expect(await CanonicalGame.countDocuments({ 'metadata.status': 'pending' })).toBe(2);
  });

  test('resumes pending games regardless of origin without requeueing failed games', async () => {
    await CanonicalGame.create([
      { canonicalTitle: 'Complete', normalizedTitle: 'complete', metadata: { status: 'complete' } },
      { canonicalTitle: 'Failed', normalizedTitle: 'failed', metadata: { status: 'failed' } },
      { canonicalTitle: 'Imported Pending', normalizedTitle: 'imported pending' },
      {
        canonicalTitle: 'Manual Pending',
        normalizedTitle: 'manual pending',
        origin: 'manual_catalogue'
      }
    ]);
    const report = await reconcileIgdbMetadata({
      config: {
        providers: { igdbClientId: 'client', igdbClientSecret: 'secret' },
        igdb: { queueLimit: 5 }
      },
      log: { info: jest.fn() }
    });
    expect(report).toMatchObject({
      total: 4,
      queued: 2,
      counts: { complete: 1, failed: 1, pending: 2 }
    });
    expect(
      await SyncJob.countDocuments({
        provider: 'igdb',
        kind: 'metadata_enrichment',
        status: 'queued'
      })
    ).toBe(2);
  });

  test('reports an explicit settled state when only terminal metadata remains', async () => {
    await CanonicalGame.create([
      { canonicalTitle: 'Complete', normalizedTitle: 'complete', metadata: { status: 'complete' } },
      { canonicalTitle: 'Terminal', normalizedTitle: 'terminal', metadata: { status: 'failed' } }
    ]);
    const log = { info: jest.fn() };
    await reconcileIgdbMetadata({
      config: {
        providers: { igdbClientId: 'client', igdbClientSecret: 'secret' },
        igdb: { queueLimit: 5 }
      },
      log
    });
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining(
        '🧠 IGDB idle: no automatic work remains. 1 game needs manual review or an explicit retry'
      )
    );
  });

  test('refills the bounded queue immediately after a completed batch', async () => {
    await CanonicalGame.create(
      Array.from({ length: 102 }, (_, index) => ({
        canonicalTitle: `Queue ${index}`,
        normalizedTitle: `queue${index}`
      }))
    );
    const config = {
      providers: { igdbClientId: 'client', igdbClientSecret: 'secret' },
      igdb: { queueLimit: 100, maxAttempts: 6 }
    };
    expect((await reconcileIgdbMetadata({ config, log: { info: jest.fn() } })).queued).toBe(100);
    await SyncJob.updateMany(
      { provider: 'igdb', kind: 'metadata_enrichment', status: 'queued' },
      { $set: { status: 'completed', completedAt: new Date() } }
    );
    const completedIds = (
      await SyncJob.find({
        provider: 'igdb',
        kind: 'metadata_enrichment',
        status: 'completed'
      }).select('+payload')
    ).map((job) => job.payload.canonicalGameId);
    await CanonicalGame.updateMany(
      { _id: { $in: completedIds } },
      { $set: { 'metadata.status': 'complete' } }
    );
    expect((await reconcileIgdbMetadata({ config, log: { info: jest.fn() } })).queued).toBe(2);
  });
});
