const mongoose = require('mongoose');
const { migrateLegacy } = require('../../src/v2/migration/legacyMigration');

describe('v1 to v2 migration', () => {
  beforeEach(async () => { await global.testUtils.cleanupDatabase(); await mongoose.connection.db.collection('users').deleteMany({}); await mongoose.connection.db.collection('games').deleteMany({}); });
  test('reports normalized username collisions before writing', async () => {
    const db = mongoose.connection.db; await db.collection('users').insertMany([{ _id: new mongoose.Types.ObjectId(), name: 'Player One', password: 'hash' }, { _id: new mongoose.Types.ObjectId(), name: 'player one', password: 'hash' }]);
    const report = await migrateLegacy({ db, mode: 'dry-run' });
    expect(report.ready).toBe(false); expect(report.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'duplicate_username_normalized' })])); expect(await db.collection('users_v2').countDocuments()).toBe(0);
  });
  test('preserves user ids/password hashes and migrates entitlement ownership idempotently', async () => {
    const db = mongoose.connection.db; const userId = new mongoose.Types.ObjectId(); const gameId = new mongoose.Types.ObjectId();
    await db.collection('users').insertOne({ _id: userId, name: 'Player One', password: '$2b$12$examplehash', isAdmin: true, steamId: '76561198000000000', games: [{ name: 'Aqua Quest', platform: 'steam', platformId: '42' }, { name: 'No Id Game', platform: 'gog' }] });
    await db.collection('games').insertOne({ _id: gameId, name: 'Aqua Quest', igdbId: 99, description: 'Water.', genres: ['Adventure'], owners: [{ userId, platforms: ['steam'] }] });
    const dry = await migrateLegacy({ db, mode: 'dry-run' }); expect(dry.ready).toBe(true);
    const applied = await migrateLegacy({ db, mode: 'apply' }); expect(applied.applied).toBe(true);
    await migrateLegacy({ db, mode: 'apply' });
    expect(await db.collection('users_v2').findOne({ _id: userId })).toMatchObject({ usernameNormalized: 'player one', passwordHash: '$2b$12$examplehash', role: 'admin', steamAccount: { steamId: '76561198000000000' } });
    expect(await db.collection('canonical_games_v2').findOne({ _id: gameId })).toMatchObject({ canonicalTitle: 'Aqua Quest', igdbId: 99, summary: 'Water.' });
    expect(await db.collection('library_items_v2').countDocuments({ userId, removedAt: null })).toBe(2);
    expect((await migrateLegacy({ db, mode: 'verify' })).valid).toBe(true);
  });
  test('collapses duplicate legacy IGDB records into one canonical survivor', async () => {
    const db = mongoose.connection.db; const first = new mongoose.Types.ObjectId(); const second = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    await db.collection('users').insertOne({ _id: userId, name: 'Player One', password: 'hash', games: [{ name: 'Aqua Quest', platform: 'steam', platformId: '42' }] });
    await db.collection('games').insertMany([{ _id: first, name: 'Aqua Quest', igdbId: 999, createdAt: new Date('2020-01-01') }, { _id: second, name: 'Aqua Quest Deluxe', igdbId: 999, description: 'Best metadata', createdAt: new Date('2021-01-01') }]);
    const report = await migrateLegacy({ db, mode: 'dry-run' });
    expect(report.ready).toBe(true); expect(report.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'duplicate_igdb_id_collapsed', groups: 1, records: 1 })]));
    await migrateLegacy({ db, mode: 'apply' });
    expect(await db.collection('canonical_games_v2').countDocuments({ igdbId: 999 })).toBe(1);
    expect(await db.collection('canonical_games_v2').findOne({ igdbId: 999 })).toMatchObject({ canonicalTitle: 'Aqua Quest Deluxe', alternativeTitles: ['Aqua Quest'] });
    expect(await db.collection('library_items_v2').findOne({ userId, providerGameId: '42' })).toMatchObject({ canonicalGameId: second });
  });
});