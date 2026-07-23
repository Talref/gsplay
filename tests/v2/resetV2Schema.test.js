const mongoose = require('mongoose');
const { resetV2Schema } = require('../../scripts/reset-v2-schema');

describe('v2 schema reset', () => {
  test('drops only named v2 collections and preserves legacy source collections', async () => {
    const db = mongoose.connection.db;
    await db.collection('users').insertOne({ name: 'Legacy Player' });
    await db.collection('games').insertOne({ name: 'Legacy Game' });
    await db.collection('users_v2').insertOne({ usernameDisplay: 'V2 Player' });
    await db.collection('library_items_v2').insertOne({ providerTitle: 'V2 Game' });
    const report = await resetV2Schema(db);
    expect(report.dropped).toEqual(expect.arrayContaining(['users_v2', 'library_items_v2']));
    expect(report.preservedLegacyCollections).toEqual(['users', 'games']);
    expect(await db.collection('users').countDocuments()).toBe(1);
    expect(await db.collection('games').countDocuments()).toBe(1);
    expect(await db.collection('users_v2').countDocuments()).toBe(0);
    expect(await db.collection('library_items_v2').countDocuments()).toBe(0);
  });
});