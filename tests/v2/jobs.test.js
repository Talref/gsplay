const { claimNextJob, completeJob, deferJob, enqueueJob, retryJob } = require('../../src/v2/jobs/jobService');

describe('v2 durable job service', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('deduplicates enqueueing and leases work to one worker', async () => {
    const first = await enqueueJob({ provider: 'steam', kind: 'provider_sync', idempotencyKey: 'steam:user:1', payload: { steamId: '1' } });
    const repeated = await enqueueJob({ provider: 'steam', kind: 'provider_sync', idempotencyKey: 'steam:user:1', payload: { steamId: '1' } });
    expect(repeated.id).toEqual(first.id);
    const claimed = await claimNextJob('worker-a', 60_000);
    expect(claimed).toMatchObject({ id: first.id, status: 'running', workerId: 'worker-a', attempts: 1 });
    expect(await claimNextJob('worker-b', 60_000)).toBeNull();
  });

  test('persists diagnostics and completes a claimed job', async () => {
    await enqueueJob({ provider: 'gog', kind: 'upload', idempotencyKey: 'upload:1' });
    const claimed = await claimNextJob('worker-a');
    const completed = await completeJob(claimed, { diagnostics: [{ code: 'invalid_row', message: 'Row 2 is malformed' }], counts: { discovered: 2, failed: 1 } });
    expect(completed).toMatchObject({ status: 'completed_with_errors' });
    expect(completed.diagnostics).toHaveLength(1);
    expect(completed.counts).toMatchObject({ discovered: 2, failed: 1 });
  });

  test('reschedules retryable work with exponential backoff before terminal failure', async () => {
    await enqueueJob({ provider: 'steam', kind: 'provider_sync', idempotencyKey: 'retry:1' });
    const first = await claimNextJob('worker-a');
    const retried = await retryJob(first, { diagnostics: [{ code: 'temporary_failure', message: 'Try again' }] });
    expect(retried).toMatchObject({ status: 'queued', attempts: 1, workerId: null });
    expect(retried.runAfter.getTime()).toBeGreaterThan(Date.now());
    retried.runAfter = new Date(0); await retried.save();
    const second = await claimNextJob('worker-a');
    second.attempts = second.maxAttempts; await second.save();
    const terminal = await retryJob(second, { diagnostics: [{ code: 'temporary_failure', message: 'Still unavailable' }] });
    expect(terminal.status).toBe('failed');
  });

  test('claims a user-visible sync ahead of ready metadata enrichment work', async () => {
    const metadata = await enqueueJob({ provider: 'igdb', kind: 'metadata_enrichment', idempotencyKey: 'metadata:1' });
    const sync = await enqueueJob({ provider: 'steam', kind: 'provider_sync', idempotencyKey: 'sync:1' });
    const claimed = await claimNextJob('worker-a');
    expect(claimed.id).toEqual(sync.id);
    const SyncJob = require('../../src/v2/models/SyncJob');
    expect((await SyncJob.findById(metadata.id)).status).toBe('queued');
  });

  test('defers a provider-paused job without consuming an attempt and can exclude metadata claims', async () => {
    const metadata = await enqueueJob({ provider: 'igdb', kind: 'metadata_enrichment', idempotencyKey: 'metadata:paused' });
    const claimed = await claimNextJob('worker-a');
    const deferred = await deferJob(claimed, { diagnostics: [{ code: 'igdb_request_failed', message: 'Too Many Requests' }] });
    expect(deferred).toMatchObject({ status: 'queued', attempts: 0, workerId: null });
    expect(await claimNextJob('worker-a', 60_000, { excludeMetadata: true })).toBeNull();
    expect((await claimNextJob('worker-a')).id).toEqual(metadata.id);
  });
});