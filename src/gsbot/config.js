const DISCORD_SNOWFLAKE = /^\d{17,20}$/;

function required(environment, name) {
  const value = environment[name]?.trim();
  if (!value || value.startsWith('replace-with-')) throw new Error(`${name} is required`);
  return value;
}

function loadGsbotEnvironment(environment = process.env) {
  const token = required(environment, 'GSBOT_TOKEN');
  const guildId = required(environment, 'GSBOT_GUILD_ID');
  if (!DISCORD_SNOWFLAKE.test(guildId)) {
    throw new Error('GSBOT_GUILD_ID must be a Discord server ID');
  }
  const mongoUri = environment.MONGO_URI || 'mongodb://127.0.0.1:27017/gsplay';
  if (!/^mongodb(\+srv)?:\/\//.test(mongoUri))
    throw new Error('MONGO_URI must be a MongoDB connection URI');
  return Object.freeze({ token, guildId, mongoUri });
}

function gsbotDeploymentMode(environment = process.env) {
  const token = environment.GSBOT_TOKEN?.trim();
  const guildId = environment.GSBOT_GUILD_ID?.trim();
  if (!token && !guildId) return 'disabled';
  loadGsbotEnvironment(environment);
  return 'enabled';
}

module.exports = { gsbotDeploymentMode, loadGsbotEnvironment };
