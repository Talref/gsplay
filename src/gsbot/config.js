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
  return Object.freeze({ token, guildId });
}

module.exports = { loadGsbotEnvironment };
