#!/usr/bin/env node

require('dotenv').config();
const { connectDatabase, disconnectDatabase } = require('../src/core/database');
const GsbotGuildConfig = require('../src/core/models/GsbotGuildConfig');

const SNOWFLAKE = /^\d{17,20}$/;

function option(name, argumentsList = process.argv.slice(2)) {
  const index = argumentsList.indexOf(`--${name}`);
  return index === -1 ? null : argumentsList[index + 1];
}

async function configureGsbot({
  guildId = option('guild-id'),
  generalChannelId = option('general-channel-id'),
  mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gsplay'
} = {}) {
  if (!SNOWFLAKE.test(guildId || '')) throw new Error('--guild-id must be a Discord server ID');
  if (!SNOWFLAKE.test(generalChannelId || ''))
    throw new Error('--general-channel-id must be a Discord channel ID');
  if (!/^mongodb(\+srv)?:\/\//.test(mongoUri))
    throw new Error('MONGO_URI must be a MongoDB connection URI');

  await connectDatabase({ mongoUri });
  try {
    const config = await GsbotGuildConfig.findOneAndUpdate(
      { guildId },
      { $set: { 'channels.general': generalChannelId } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    console.info(
      `Configured GSbot general channel ${config.channels.general} for guild ${guildId}`
    );
    return config;
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module)
  configureGsbot().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });

module.exports = { configureGsbot, option };
