const SNOWFLAKE = /^\d{17,20}$/;

function ids(value, name, required = false) {
  if (!value?.trim()) {
    if (required) throw new Error(`${name} is required`);
    return [];
  }
  const result = value.split(',').map((id) => id.trim());
  if (result.some((id) => !SNOWFLAKE.test(id))) {
    throw new Error(`${name} must contain Discord IDs separated by commas`);
  }
  return [...new Set(result)];
}

function integer(env, name, fallback, min, max) {
  const raw = env[name]?.trim() || String(fallback);
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function loadDrracoonEnvironment(env = process.env) {
  const token = env.DRRACOON_TOKEN?.trim();
  if (!token && !env.DRRACOON_GUILD_IDS?.trim()) return { enabled: false };
  if (!token || token.startsWith('replace-with-')) throw new Error('DRRACOON_TOKEN is required');
  const guildIds = ids(env.DRRACOON_GUILD_IDS, 'DRRACOON_GUILD_IDS', true);
  let baseUrl;
  try {
    baseUrl = new URL(env.DRRACOON_LLM_BASE_URL || 'http://127.0.0.1:10743/v1');
  } catch {
    throw new Error('DRRACOON_LLM_BASE_URL must be an HTTP(S) URL');
  }
  if (
    !['http:', 'https:'].includes(baseUrl.protocol) ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new Error(
      'DRRACOON_LLM_BASE_URL must be HTTP(S), without credentials, query or fragment'
    );
  }
  const mongoUri = env.MONGO_URI || 'mongodb://127.0.0.1:27017/gsplay';
  if (!/^mongodb(\+srv)?:\/\//.test(mongoUri))
    throw new Error('MONGO_URI must be a MongoDB connection URI');
  const config = {
    enabled: true,
    token,
    guildIds,
    mongoUri,
    staffRoleIds: ids(env.DRRACOON_STAFF_ROLE_IDS, 'DRRACOON_STAFF_ROLE_IDS'),
    staffChannelIds: ids(env.DRRACOON_STAFF_CHANNEL_IDS, 'DRRACOON_STAFF_CHANNEL_IDS'),
    baseUrl: baseUrl.href.replace(/\/$/, ''),
    model: env.DRRACOON_LLM_MODEL?.trim() || 'gsbot-gemma',
    apiKey: env.DRRACOON_LLM_API_KEY?.trim() || null,
    contextSize: integer(env, 'DRRACOON_CONTEXT_SIZE', 32768, 1024, 2000000),
    maxOutputTokens: integer(env, 'DRRACOON_MAX_OUTPUT_TOKENS', 1024, 1, 131072),
    requestTimeoutMs: integer(env, 'DRRACOON_REQUEST_TIMEOUT_MS', 120000, 100, 1800000),
    maxConcurrent: integer(env, 'DRRACOON_MAX_CONCURRENT', 1, 1, 10),
    maxToolRounds: integer(env, 'DRRACOON_MAX_TOOL_ROUNDS', 3, 0, 10),
    queueLimit: integer(env, 'DRRACOON_QUEUE_LIMIT', 20, 1, 1000),
    stream: env.DRRACOON_LLM_STREAM === 'true'
  };
  if (env.DRRACOON_LLM_STREAM && !['true', 'false'].includes(env.DRRACOON_LLM_STREAM)) {
    throw new Error('DRRACOON_LLM_STREAM must be true or false');
  }
  if (config.maxOutputTokens + 512 >= config.contextSize) {
    throw new Error('DRRACOON_CONTEXT_SIZE must reserve space beyond output tokens');
  }
  return Object.freeze(config);
}

module.exports = { loadDrracoonEnvironment };
