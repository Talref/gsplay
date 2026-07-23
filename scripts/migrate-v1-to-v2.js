require('dotenv').config();
const { loadEnvironment } = require('../src/v2/config/environment');
const { connectDatabase, disconnectDatabase } = require('../src/v2/database');
const { migrateLegacy } = require('../src/v2/migration/legacyMigration');
const mongoose = require('mongoose');

async function main(argv = process.argv.slice(2)) {
  const mode = argv.includes('--apply') ? 'apply' : argv.includes('--verify') ? 'verify' : 'dry-run';
  if (mode === 'apply' && !argv.includes('--confirm-migrate-v1-to-v2')) throw new Error('Refusing to write: add --confirm-migrate-v1-to-v2 after reviewing a dry run');
  const config = loadEnvironment(); await connectDatabase(config);
  try { const report = await migrateLegacy({ db: mongoose.connection.db, mode }); console.log(JSON.stringify(report, null, 2)); if ((mode === 'dry-run' && !report.ready) || (mode === 'verify' && !report.valid)) process.exitCode = 2; return report; } finally { await disconnectDatabase(); }
}
if (require.main === module) main().catch((error) => { console.error(error.message); if (error.report) console.error(JSON.stringify(error.report, null, 2)); process.exitCode = 1; });
module.exports = { main };