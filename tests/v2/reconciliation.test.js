const mongoose = require('mongoose');
const User = require('../../src/v2/models/User');
const GameAlias = require('../../src/v2/models/GameAlias');
const LibraryItem = require('../../src/v2/models/LibraryItem');
const CanonicalGame = require('../../src/v2/models/CanonicalGame');
const SyncJob = require('../../src/v2/models/SyncJob');
const { reconcileProviderLibrary } = require('../../src/v2/services/libraryReconciliation');

describe('v2 entitlement reconciliation', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());
  test('upserts active entitlement records, applies aliases, and soft-removes absent records', async () => {
    const user = await User.create({ usernameNormalized: 'reconcile', usernameDisplay: 'Reconcile', passwordHash: await User.hashPassword('correct-horse-battery-staple') });
    const game = await CanonicalGame.create({ canonicalTitle: 'Aqua Quest', normalizedTitle: 'aqua quest' });
    await GameAlias.create({ provider: 'steam', providerGameId: '10', normalizedProviderTitle: 'aqua quest', canonicalGameId: game._id, matchType: 'provider_id', confidence: 1 });
    await LibraryItem.create({ userId: user._id, provider: 'steam', providerGameId: 'old', providerTitle: 'Old', normalizedTitle: 'old', source: 'api' });
    const result = await reconcileProviderLibrary({ userId: user._id, provider: 'steam', games: [{ providerGameId: 10, providerTitle: 'Aqua Quest' }] });
    expect(result).toMatchObject({ discovered: 1, removed: 1 });
    expect(await LibraryItem.findOne({ userId: user._id, providerGameId: 'old' })).toMatchObject({ removedAt: expect.any(Date) });
    expect(await LibraryItem.findOne({ userId: user._id, providerGameId: '10' })).toMatchObject({ canonicalGameId: game._id, matchStatus: 'auto_matched' });
  });

  test('auto-matches a unique normalized canonical title but marks duplicates ambiguous', async () => {
    const unique = await CanonicalGame.create({ canonicalTitle: 'Aqua Quest', normalizedTitle: 'aqua quest' });
    await CanonicalGame.create([{ canonicalTitle: 'Twin', normalizedTitle: 'twin' }, { canonicalTitle: 'Twin: Remaster', normalizedTitle: 'twin' }]);
    const user = await User.create({ usernameNormalized: 'matcher', usernameDisplay: 'Matcher', passwordHash: await User.hashPassword('correct-horse-battery-staple') });
    await reconcileProviderLibrary({ userId: user._id, provider: 'gog', games: [{ providerGameId: 'unique', providerTitle: 'Aqua Quest' }, { providerGameId: 'ambiguous', providerTitle: 'Twin' }], sourceImportId: new mongoose.Types.ObjectId() });
    expect(await LibraryItem.findOne({ providerGameId: 'unique' })).toMatchObject({ canonicalGameId: unique._id, matchStatus: 'auto_matched', matchMethod: 'exact_normalized_title' });
    expect(await LibraryItem.findOne({ providerGameId: 'ambiguous' })).toMatchObject({ canonicalGameId: null, matchStatus: 'ambiguous', matchMethod: 'multiple_exact_normalized_titles' });
  });

  test('creates a provisional canonical game when a fresh title has no match', async () => {
    const user = await User.create({ usernameNormalized: 'fresh-title', usernameDisplay: 'Fresh Title', passwordHash: await User.hashPassword('correct-horse-battery-staple') });
    await reconcileProviderLibrary({ userId: user._id, provider: 'epic', games: [{ providerGameId: 'fresh-1', providerTitle: 'Brand New Game' }], sourceImportId: new mongoose.Types.ObjectId() });
    const canonical = await CanonicalGame.findOne({ normalizedTitle: 'brand new game' }).lean();
    expect(canonical.canonicalTitle).toBe('Brand New Game');
    expect(canonical.metadata.status).toBe('pending');
    expect(await LibraryItem.findOne({ providerGameId: 'fresh-1' })).toMatchObject({ canonicalGameId: canonical._id, matchStatus: 'auto_matched', matchConfidence: 0.75, matchMethod: 'provisional_exact_title' });
    expect(await SyncJob.countDocuments({ kind: 'metadata_enrichment' })).toBe(0);
  });

  test('does not report re-observed unchanged entitlements as updates', async () => {
    const user = await User.create({ usernameNormalized: 'unchanged', usernameDisplay: 'Unchanged', passwordHash: await User.hashPassword('correct-horse-battery-staple') });
    const game = { providerGameId: 'same-game', providerTitle: 'Same Game' };

    expect(await reconcileProviderLibrary({ userId: user._id, provider: 'steam', games: [game] })).toMatchObject({ created: 1, updated: 0 });
    expect(await reconcileProviderLibrary({ userId: user._id, provider: 'steam', games: [game] })).toMatchObject({ created: 0, updated: 0, removed: 0 });
  });
});