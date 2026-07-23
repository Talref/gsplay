require('dotenv').config();
const mongoose = require('mongoose');
const { loadEnvironment } = require('../src/v2/config/environment');
const { connectDatabase, disconnectDatabase } = require('../src/v2/database');

const V2_COLLECTIONS = ['users_v2', 'library_items_v2', 'canonical_games_v2', 'game_aliases_v2', 'sync_jobs_v2', 'refresh_sessions_v2', 'retro_challenges_v2', 'canonical_game_merges_v2'];

async function resetV2Schema(db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name));
  const dropped = [];
  for (const name of V2_COLLECTIONS) if (existing.has(name)) { await db.collection(name).drop(); dropped.push(name); }
  return { dropped, preservedLegacyCollections: ['users', 'games'] };
}

async function main(argv = process.argv.slice(2)) {
  if (!argv.includes('--confirm-reset-v2-schema')) throw new Error('Refusing to drop v2 collections: add --confirm-reset-v2-schema after reviewing the migration fix');
  const config = loadEnvironment(); await connectDatabase(config);
  try { const report = await resetV2Schema(mongoose.connection.db); console.log(JSON.stringify(report, null, 2)); return report; } finally { await disconnectDatabase(); }
}
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { V2_COLLECTIONS, resetV2Schema, main };