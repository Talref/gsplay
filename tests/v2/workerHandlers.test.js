const User = require('../../src/v2/models/User');
const { createJobHandlers } = require('../../src/v2/jobs/handlers');
const { enqueueJob, claimNextJob } = require('../../src/v2/jobs/jobService');
const LibraryItem = require('../../src/v2/models/LibraryItem');
const { SteamProviderError } = require('../../src/v2/providers/steamClient');
const { IgdbProviderError } = require('../../src/v2/providers/igdbClient');
const CanonicalGame = require('../../src/v2/models/CanonicalGame');

const config = { providers: { steamApiKey: 'not-a-real-key' } };
describe('v2 worker provider handlers', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());
  test('reconciles a Steam job using the currently linked account', async () => {
    const user = await User.create({ usernameNormalized: 'steam-user', usernameDisplay: 'Steam User', passwordHash: await User.hashPassword('correct-horse-battery-staple'), steamAccount: { steamId: '76561198000000000' } });
    await enqueueJob({ userId: user._id, provider: 'steam', kind: 'provider_sync', idempotencyKey: 'steam-job' });
    const job = await claimNextJob('worker');
    const handlers = createJobHandlers(config, { steamClient: { listOwnedGames: jest.fn().mockResolvedValue([{ providerGameId: '10', providerTitle: 'Aqua Quest' }]) } });
    expect(await handlers.provider_sync(job)).toMatchObject({ counts: { discovered: 1, created: 1 } });
    expect(await LibraryItem.findOne({ userId: user._id, providerGameId: '10' })).toBeTruthy();
    expect((await User.findById(user._id)).steamAccount.lastSyncedAt).toEqual(expect.any(Date));
  });

  test('reports provider outages as retryable without requiring a Steam key at worker boot', async () => {
    const user = await User.create({ usernameNormalized: 'retry-user', usernameDisplay: 'Retry User', passwordHash: await User.hashPassword('correct-horse-battery-staple'), steamAccount: { steamId: '76561198000000000' } });
    await enqueueJob({ userId: user._id, provider: 'steam', kind: 'provider_sync', idempotencyKey: 'retry-job' });
    const job = await claimNextJob('worker');
    const handlers = createJobHandlers({ providers: { steamApiKey: null } }, { steamClient: { listOwnedGames: jest.fn().mockRejectedValue(new SteamProviderError('Unavailable', true)) } });
    await expect(handlers.provider_sync(job)).resolves.toMatchObject({ retryable: true, failed: false, diagnostics: [{ code: 'steam_retryable_error' }] });
  });

  test('enriches a provisional canonical game through an exact IGDB result', async () => {
    const game = await CanonicalGame.create({ canonicalTitle: 'Aqua Quest', normalizedTitle: 'aquaquest' });
    await enqueueJob({ provider: 'igdb', kind: 'metadata_enrichment', payload: { canonicalGameId: game._id.toString() }, idempotencyKey: 'igdb-job' });
    const job = await claimNextJob('worker');
    const handlers = createJobHandlers(config, { igdbClient: { findExactTitle: jest.fn().mockResolvedValue({ igdbId: 44, canonicalTitle: 'Aqua Quest', normalizedTitle: 'aquaquest', genres: ['Adventure'], metadata: 'ignored' }) } });
    await expect(handlers.metadata_enrichment(job)).resolves.toMatchObject({ counts: { matched: 1, updated: 1 } });
    expect(await CanonicalGame.findById(game._id).lean()).toMatchObject({ igdbId: 44, genres: ['Adventure'], metadata: { status: 'complete', attempts: 1 } });
  });

  test('keeps retryable IGDB outages durable and marks canonical metadata accordingly', async () => {
    const game = await CanonicalGame.create({ canonicalTitle: 'Aqua Quest', normalizedTitle: 'aquaquest' });
    await enqueueJob({ provider: 'igdb', kind: 'metadata_enrichment', payload: { canonicalGameId: game._id.toString() }, idempotencyKey: 'igdb-retry-job' });
    const job = await claimNextJob('worker');
    const handlers = createJobHandlers(config, { igdbClient: { findExactTitle: jest.fn().mockRejectedValue(new IgdbProviderError('Unavailable', true)) } });
    await expect(handlers.metadata_enrichment(job)).resolves.toMatchObject({ retryable: true, failed: false, diagnostics: [{ code: 'igdb_retryable_error' }] });
    expect(await CanonicalGame.findById(game._id).lean()).toMatchObject({ metadata: { status: 'retryable_error', attempts: 1 } });
  });
});