const DISCORD_SNOWFLAKE = /^\d{17,20}$/;

function required(environment, name) {
  const value = environment[name]?.trim();
  if (!value || value.startsWith('replace-with-')) throw new Error(`${name} is required`);
  return value;
}

function configuredGuildIds(environment) {
  const configured = environment.GSBOT_GUILD_IDS?.trim();
  const legacy = environment.GSBOT_GUILD_ID?.trim();
  const source = configured || legacy;
  const name = configured ? 'GSBOT_GUILD_IDS' : 'GSBOT_GUILD_ID';
  if (!source || source.startsWith('replace-with-'))
    throw new Error('GSBOT_GUILD_IDS or GSBOT_GUILD_ID is required');
  const guildIds = source.split(',').map((guildId) => guildId.trim());
  if (guildIds.some((guildId) => !DISCORD_SNOWFLAKE.test(guildId))) {
    throw new Error(
      configured
        ? `${name} must contain only Discord server IDs separated by commas`
        : `${name} must be a Discord server ID`
    );
  }
  return [...new Set(guildIds)];
}

function loadGsbotEnvironment(environment = process.env) {
  const token = required(environment, 'GSBOT_TOKEN');
  const guildIds = configuredGuildIds(environment);
  const mongoUri = environment.MONGO_URI || 'mongodb://127.0.0.1:27017/gsplay';
  if (!/^mongodb(\+srv)?:\/\//.test(mongoUri))
    throw new Error('MONGO_URI must be a MongoDB connection URI');
  return Object.freeze({ token, guildIds: Object.freeze(guildIds), mongoUri });
}

function gsbotDeploymentMode(environment = process.env) {
  const token = environment.GSBOT_TOKEN?.trim();
  const guildIds = environment.GSBOT_GUILD_IDS?.trim() || environment.GSBOT_GUILD_ID?.trim();
  if (!token && !guildIds) return 'disabled';
  loadGsbotEnvironment(environment);
  return 'enabled';
}

module.exports = { gsbotDeploymentMode, loadGsbotEnvironment };
