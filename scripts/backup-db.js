#!/usr/bin/env node
require('dotenv').config();
const { loadEnvironment } = require('../src/v2/config/environment');
const { runDatabaseBackup } = require('../src/v2/services/databaseBackupService');

async function main() {
  const config = loadEnvironment();
  const result = await runDatabaseBackup({
    mongoUri: config.mongoUri,
    backupConfig: config.dbBackup,
    log: console
  });
  if (result.status === 'unconfigured') {
    console.error('DB backup failed: DB_BACKUP_DIR is not configured');
    process.exitCode = 1;
  } else if (result.status === 'failed') {
    process.exitCode = 1;
  } else if (result.status === 'already_completed') {
    console.info(`DB backup already completed: ${result.path}`);
  }
}

main().catch((error) => {
  console.error(`DB backup failed: ${error.message}`);
  process.exitCode = 1;
});
