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
    await expect(handlers.provider_sync(job)).resolves.toMatchObject({ retryable: true, failed: false, diagnostics: [{ code: 'steam_request_failed' }] });
  });

  test('enriches a provisional canonical game through an exact IGDB result', async () => {
    const game = await CanonicalGame.create({ canonicalTitle: 'Aqua Quest', normalizedTitle: 'aquaquest' });
    await enqueueJob({ provider: 'igdb', kind: 'metadata_enrichment', payload: { canonicalGameId: game._id.toString() }, idempotencyKey: 'igdb-job' });
    const job = await claimNextJob('worker');
    const log = { info: jest.fn(), warn: jest.fn() }; const handlers = createJobHandlers(config, { log, igdbClient: { findExactTitle: jest.fn().mockResolvedValue({ igdbId: 44, canonicalTitle: 'Aqua Quest', normalizedTitle: 'aquaquest', genres: ['Adventure'], videos: ['dQw4w9WgXcQ'], metadata: 'ignored' }) } });
    await expect(handlers.metadata_enrichment(job)).resolves.toMatchObject({ counts: { matched: 1, updated: 1 } });
    expect(await CanonicalGame.findById(game._id).lean()).toMatchObject({ igdbId: 44, genres: ['Adventure'], videos: ['dQw4w9WgXcQ'], metadata: { status: 'complete', attempts: 1 } });
    expect(log.info).not.toHaveBeenCalled();
  });

  test('refreshes an already identified game by its stable IGDB ID', async () => {
    const game = await CanonicalGame.create({ canonicalTitle: 'Old Aqua', normalizedTitle: 'old aqua', igdbId: 44, videos: [], metadata: { status: 'complete', attempts: 1 } });
    await enqueueJob({ provider: 'igdb', kind: 'metadata_enrichment', payload: { canonicalGameId: game._id.toString() }, idempotencyKey: 'igdb-exact-refresh' });
    const job = await claimNextJob('worker');
    const getGameById = jest.fn().mockResolvedValue({ igdbId: 44, canonicalTitle: 'Aqua Quest', normalizedTitle: 'aquaquest', videos: ['dQw4w9WgXcQ'] });
    const handlers = createJobHandlers({ providers: { igdbClientId: 'client', igdbClientSecret: 'secret' } }, { igdbClient: { getGameById } });
    await expect(handlers.metadata_enrichment(job)).resolves.toMatchObject({ outcome: 'matched' });
    expect(getGameById).toHaveBeenCalledWith(44);
    expect(await CanonicalGame.findById(game._id).lean()).toMatchObject({ videos: ['dQw4w9WgXcQ'], metadata: { status: 'complete', attempts: 2 } });
  });

  test('marks only active catalogue records eligible during a full metadata refresh', async () => {
    const active = await CanonicalGame.create({ canonicalTitle: 'Active', normalizedTitle: 'active', metadata: { status: 'complete' } });
    const hidden = await CanonicalGame.create({ canonicalTitle: 'Hidden', normalizedTitle: 'hidden', hiddenAt: new Date(), metadata: { status: 'complete' } });
    const handlers = createJobHandlers({ providers: { igdbClientId: 'client', igdbClientSecret: 'secret' } });
    await expect(handlers.metadata_repair({ provider: 'igdb', payload: { mode: 'refresh_all' } })).resolves.toMatchObject({ counts: { discovered: 1 } });
    expect(await CanonicalGame.findById(active._id).lean()).toMatchObject({ metadata: { status: 'pending' } });
    expect(await CanonicalGame.findById(hidden._id).lean()).toMatchObject({ metadata: { status: 'complete' } });
  });

  test('retries a transient IGDB outage without pausing the provider', async () => {
    const game = await CanonicalGame.create({ canonicalTitle: 'Aqua Quest', normalizedTitle: 'aquaquest' });
    await enqueueJob({ provider: 'igdb', kind: 'metadata_enrichment', payload: { canonicalGameId: game._id.toString() }, idempotencyKey: 'igdb-retry-job' });
    const job = await claimNextJob('worker');
    const log = { info: jest.fn(), warn: jest.fn() }; const handlers = createJobHandlers(config, { log, igdbClient: { findExactTitle: jest.fn().mockRejectedValue(new IgdbProviderError('Unavailable', true)) } });
    await expect(handlers.metadata_enrichment(job)).resolves.toMatchObject({ retryable: true, diagnostics: [{ code: 'igdb_request_failed' }] });
    expect(await CanonicalGame.findById(game._id).lean()).toMatchObject({ metadata: { status: 'pending', attempts: 0 } });
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('⚠️ IGDB · request failed'));
  });

  test('pauses IGDB enrichment only for an explicit authentication rejection', async () => {
    const game = await CanonicalGame.create({ canonicalTitle: 'Auth Game', normalizedTitle: 'authgame' });
    await enqueueJob({ provider: 'igdb', kind: 'metadata_enrichment', payload: { canonicalGameId: game._id.toString() }, idempotencyKey: 'igdb-auth-job' });
    const job = await claimNextJob('worker');
    const handlers = createJobHandlers(config, { igdbClient: { findExactTitle: jest.fn().mockRejectedValue(new IgdbProviderError('Unauthorized', false, 401, undefined, true)) } });
    await expect(handlers.metadata_enrichment(job)).resolves.toMatchObject({ stopProvider: true, diagnostics: [{ code: 'igdb_authentication_failed' }] });
  });

  test('pauses rather than retries when IGDB credentials are unavailable', async () => {
    const game = await CanonicalGame.create({ canonicalTitle: 'Among Us', normalizedTitle: 'amongus' });
    await enqueueJob({ provider: 'igdb', kind: 'metadata_enrichment', payload: { canonicalGameId: game._id.toString() }, idempotencyKey: 'igdb-missing-config' });
    const job = await claimNextJob('worker');
    const handlers = createJobHandlers({ providers: {} });
    await expect(handlers.metadata_enrichment(job)).resolves.toMatchObject({ stopProvider: true, diagnostics: [{ code: 'igdb_not_configured' }] });
    expect(await CanonicalGame.findById(game._id).lean()).toMatchObject({ metadata: { status: 'pending' } });
  });

  test('treats an exact-search miss as a persisted failed outcome, not a worker exception', async () => {
    const game = await CanonicalGame.create({ canonicalTitle: 'Missing Game', normalizedTitle: 'missinggame' });
    await enqueueJob({ provider: 'igdb', kind: 'metadata_enrichment', payload: { canonicalGameId: game._id.toString() }, idempotencyKey: 'igdb-no-match-job' });
    const job = await claimNextJob('worker');
    const log = { info: jest.fn(), warn: jest.fn() }; const handlers = createJobHandlers(config, { log, igdbClient: { findExactTitle: jest.fn().mockResolvedValue(null) } });
    await expect(handlers.metadata_enrichment(job)).resolves.toMatchObject({ diagnostics: [{ code: 'igdb_no_verified_match' }] });
    expect(await CanonicalGame.findById(game._id).lean()).toMatchObject({ metadata: { status: 'failed', attempts: 1 } });
    expect(log.info).not.toHaveBeenCalled();
  });

  test('persists valid no-match candidates without stopping the IGDB provider', async () => {
    const game = await CanonicalGame.create({ canonicalTitle: 'Bad North Jotunn Edition', normalizedTitle: 'badnorthjotunnedition' });
    await enqueueJob({ provider: 'igdb', kind: 'metadata_enrichment', payload: { canonicalGameId: game._id.toString() }, idempotencyKey: 'igdb-candidates-job' });
    const job = await claimNextJob('worker');
    const handlers = createJobHandlers(config, { igdbClient: { searchTitle: jest.fn().mockResolvedValue({ outcome: 'not_found', candidates: [{ igdbId: 44, title: 'Bad North' }, { igdbId: 45, title: 'Bad North: Jotunn Edition' }] }) } });
    await expect(handlers.metadata_enrichment(job)).resolves.toMatchObject({ diagnostics: [{ code: 'igdb_no_verified_match' }] });
    expect(await CanonicalGame.findById(game._id).lean()).toMatchObject({ metadata: { status: 'failed', attempts: 1 }, metadataCandidates: [{ igdbId: 44, title: 'Bad North' }, { igdbId: 45, title: 'Bad North: Jotunn Edition' }] });
  });

  test('marks a duplicate IGDB identity terminal for supervised merge review', async () => {
    const existing = await CanonicalGame.create({ canonicalTitle: 'Control', normalizedTitle: 'control', igdbId: 991 });
    const duplicate = await CanonicalGame.create({ canonicalTitle: 'Control', normalizedTitle: 'control' });
    await enqueueJob({ provider: 'igdb', kind: 'metadata_enrichment', payload: { canonicalGameId: duplicate._id.toString() }, idempotencyKey: 'igdb-duplicate-job' });
    const job = await claimNextJob('worker');
    const handlers = createJobHandlers(config, { igdbClient: { findExactTitle: jest.fn().mockResolvedValue({ igdbId: 991, canonicalTitle: 'Control', normalizedTitle: 'control', platforms: ['PC (Microsoft Windows)'] }) } });
    await expect(handlers.metadata_enrichment(job)).resolves.toMatchObject({ outcome: 'duplicate', duplicateTitle: 'Control', diagnostics: [{ code: 'igdb_duplicate', itemReference: existing._id.toString() }] });
    expect(await CanonicalGame.findById(existing._id).lean()).toMatchObject({ igdbId: 991, metadata: { status: 'pending', attempts: 0 } });
    const persistedDuplicate = await CanonicalGame.findById(duplicate._id).lean();
    expect(persistedDuplicate).toMatchObject({ metadata: { status: 'failed', attempts: 1 }, metadataCandidates: [{ igdbId: 991, title: 'Control' }] });
    expect(persistedDuplicate.igdbId).toBeUndefined();
  });
});