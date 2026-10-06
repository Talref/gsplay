#!/usr/bin/env node

require('dotenv').config();
const { connectDatabase, disconnectDatabase } = require('../src/core/database');
const { resetGsbotGuildData } = require('../src/core/services/gsbotGuildResetService');

const SNOWFLAKE = /^\d{17,20}$/;

function option(name, argumentsList) {
  const index = argumentsList.indexOf(`--${name}`);
  return index === -1 ? null : argumentsList[index + 1];
}

function validateConfirmation(guildId, confirmation) {
  if (!SNOWFLAKE.test(guildId || '')) throw new Error('--guild-id must be a Discord server ID');
  if (!confirmation) throw new Error(`Refusing to reset guild ${guildId}: --confirm is required`);
  if (confirmation !== guildId)
    throw new Error(
      `Refusing to reset guild ${guildId}: --confirm must exactly match the guild ID`
    );
}

function printSummary(guildId, counts, output) {
  output.info(`Reset complete for GSbot guild ${guildId}:`);
  output.info(`  birthdays: ${counts.birthdays}`);
  output.info(`  guild configurations: ${counts.guildConfigurations}`);
  output.info(`  temporary tags: ${counts.temporaryTags}`);
  output.info(`  temporary tag invites: ${counts.temporaryTagInvites}`);
  output.info(`  scheduled jobs: ${counts.scheduledJobs}`);
}

async function runGsbotGuildReset({
  argumentsList = process.argv.slice(2),
  mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gsplay',
  output = console,
  connect = connectDatabase,
  disconnect = disconnectDatabase,
  reset = resetGsbotGuildData
} = {}) {
  const guildId = option('guild-id', argumentsList);
  const confirmation = option('confirm', argumentsList);
  validateConfirmation(guildId, confirmation);
  if (!/^mongodb(\+srv)?:\/\//.test(mongoUri))
    throw new Error('MONGO_URI must be a MongoDB connection URI');

  output.info(`Resetting GSbot data for guild ${guildId}...`);
  await connect({ mongoUri });
  try {
    const counts = await reset(guildId);
    printSummary(guildId, counts, output);
    return counts;
  } finally {
    await disconnect();
  }
}

if (require.main === module)
  runGsbotGuildReset().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });

module.exports = {
  option,
  printSummary,
  runGsbotGuildReset,
  validateConfirmation
};
