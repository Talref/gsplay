require('dotenv').config();
const { loadEnvironment } = require('../src/v2/config/environment');
const { connectDatabase, disconnectDatabase } = require('../src/v2/database');
const {
  inspectCancelledLegacyPlaylist,
  removeCancelledLegacyPlaylist,
  validateWeekKey
} = require('../src/v2/services/cancelledLegacyPlaylistCleanup');

function argumentsFrom(argv) {
  const values = { execute: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--execute') values.execute = true;
    else if (argument === '--week') values.weekKey = argv[++index];
    else if (argument === '--playlist-id') values.playlistId = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  validateWeekKey(values.weekKey);
  if (values.execute && !values.playlistId) throw new Error('--playlist-id is required with --execute');
  return values;
}

function printSummary(summary) {
  console.info(`Week:          ${summary.weekKey}`);
  console.info(`Playlist:      ${summary.playlistId}`);
  console.info(`Status:        ${summary.status}`);
  console.info(`Starts:        ${summary.startsAt.toISOString()}`);
  console.info(`Ends:          ${summary.endsAt.toISOString()}`);
  console.info(`Cancelled:     ${summary.cancelledAt?.toISOString() || 'not recorded'}`);
  console.info(`Entries:       ${summary.entryCount}`);
  console.info(`Reason:        ${summary.cancellationReason || 'not recorded'}`);
}

async function main(argv = process.argv.slice(2)) {
  const options = argumentsFrom(argv);
  const config = loadEnvironment();
  await connectDatabase(config);
  const summary = await inspectCancelledLegacyPlaylist(options.weekKey);
  printSummary(summary);
  if (!options.execute) {
    console.info('\nDRY RUN: nothing was deleted.');
    console.info(
      `After backup and stopping both services, execute with: --week ${summary.weekKey} --playlist-id ${summary.playlistId} --execute`
    );
    return summary;
  }
  await removeCancelledLegacyPlaylist(options.weekKey, options.playlistId);
  console.info('\nDeleted the guarded cancelled legacy playlist and its entries; verification passed.');
  return summary;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(disconnectDatabase);
}

module.exports = { argumentsFrom, main };
