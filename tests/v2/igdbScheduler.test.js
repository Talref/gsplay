const CanonicalGame = require('../../src/v2/models/CanonicalGame');
const SyncJob = require('../../src/v2/models/SyncJob');
const { createIgdbGate, reconcileIgdbMetadata } = require('../../src/v2/jobs/igdbScheduler');

describe('v2 IGDB scheduler', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('paces calls and applies a cooldown after a rate limit', async () => {
    let clock = 0; const sleeps = []; const gate = createIgdbGate({ minIntervalMs: 500, cooldownMs: 60_000, now: () => clock, sleep: async (ms) => { sleeps.push(ms); clock += ms; }, log: { warn: jest.fn() } });
    await gate.run(async () => 'one');
    await gate.run(async () => 'two');
    await expect(gate.run(async () => { const error = new Error('rate limit'); error.status = 429; error.retryable = true; throw error; })).rejects.toThrow('rate limit');
    await gate.run(async () => 'four');
    expect(sleeps).toEqual(expect.arrayContaining([500, 60_000]));
  });

  test('requeues bounded pending metadata and reclaims expired IGDB leases', async () => {
    const first = await CanonicalGame.create({ canonicalTitle: 'One', normalizedTitle: 'one' });
    const second = await CanonicalGame.create({ canonicalTitle: 'Two', normalizedTitle: 'two' });
    await SyncJob.create({ provider: 'igdb', kind: 'metadata_enrichment', status: 'running', idempotencyKey: 'expired-lease', payload: { canonicalGameId: first._id.toString() }, leaseExpiresAt: new Date(0) });
    const config = { providers: { igdbClientId: 'client', igdbClientSecret: 'secret' }, igdb: { queueLimit: 1 } };
    const report = await reconcileIgdbMetadata({ config, log: { info: jest.fn() } });
    expect(report.staleLeases).toBe(1);
    expect(report.queued).toBeLessThanOrEqual(1);
    expect(await SyncJob.countDocuments({ provider: 'igdb', kind: 'metadata_enrichment', status: 'queued' })).toBeGreaterThanOrEqual(1);
    expect(await CanonicalGame.countDocuments({ 'metadata.status': 'pending' })).toBe(2);
  });

  test('resumes pending games regardless of origin without requeueing failed games', async () => {
    await CanonicalGame.create([{ canonicalTitle: 'Complete', normalizedTitle: 'complete', metadata: { status: 'complete' } }, { canonicalTitle: 'Failed', normalizedTitle: 'failed', metadata: { status: 'failed' } }, { canonicalTitle: 'Imported Pending', normalizedTitle: 'imported pending' }, { canonicalTitle: 'Manual Pending', normalizedTitle: 'manual pending', origin: 'manual_catalogue' }]);
    const report = await reconcileIgdbMetadata({ config: { providers: { igdbClientId: 'client', igdbClientSecret: 'secret' }, igdb: { queueLimit: 5 } }, log: { info: jest.fn() } });
    expect(report).toMatchObject({ total: 4, queued: 2, counts: { complete: 1, failed: 1, pending: 2 } });
    expect(await SyncJob.countDocuments({ provider: 'igdb', kind: 'metadata_enrichment', status: 'queued' })).toBe(2);
  });

  test('reports an explicit settled state when only terminal metadata remains', async () => {
    await CanonicalGame.create([{ canonicalTitle: 'Complete', normalizedTitle: 'complete', metadata: { status: 'complete' } }, { canonicalTitle: 'Terminal', normalizedTitle: 'terminal', metadata: { status: 'failed' } }]);
    const log = { info: jest.fn() };
    await reconcileIgdbMetadata({ config: { providers: { igdbClientId: 'client', igdbClientSecret: 'secret' }, igdb: { queueLimit: 5 } }, log });
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('🧠 IGDB idle: no automatic work remains. 1 game needs manual review or an explicit retry'));
  });

  test('refills the bounded queue immediately after a completed batch', async () => {
    await CanonicalGame.create(Array.from({ length: 102 }, (_, index) => ({ canonicalTitle: `Queue ${index}`, normalizedTitle: `queue${index}` })));
    const config = { providers: { igdbClientId: 'client', igdbClientSecret: 'secret' }, igdb: { queueLimit: 100, maxAttempts: 6 } };
    expect((await reconcileIgdbMetadata({ config, log: { info: jest.fn() } })).queued).toBe(100);
    await SyncJob.updateMany({ provider: 'igdb', kind: 'metadata_enrichment', status: 'queued' }, { $set: { status: 'completed', completedAt: new Date() } });
    const completedIds = (await SyncJob.find({ provider: 'igdb', kind: 'metadata_enrichment', status: 'completed' }).select('+payload')).map((job) => job.payload.canonicalGameId);
    await CanonicalGame.updateMany({ _id: { $in: completedIds } }, { $set: { 'metadata.status': 'complete' } });
    expect((await reconcileIgdbMetadata({ config, log: { info: jest.fn() } })).queued).toBe(2);
  });
});