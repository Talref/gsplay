const IGDB_LOG = '🧠 IGDB';

function createIgdbGate({
  minIntervalMs = 500,
  cooldownMs = 60_000,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = console
} = {}) {
  let nextAllowedAt = 0;
  let cooldownUntil = 0;
  return {
    async run(action) {
      const waitMs = Math.max(0, nextAllowedAt - now(), cooldownUntil - now());
      if (waitMs) await sleep(waitMs);
      try {
        const result = await action();
        nextAllowedAt = now() + minIntervalMs;
        return result;
      } catch (error) {
        nextAllowedAt = now() + minIntervalMs;
        if (
          error?.status === 429 ||
          (error?.retryable && /rate limit/i.test(error.message || ''))
        ) {
          cooldownUntil = now() + cooldownMs;
          log.warn(
            `${IGDB_LOG} cooldown · reason=rate_limited · until=${new Date(cooldownUntil).toISOString()}`
          );
        }
        throw error;
      }
    },
    snapshot: () => ({ nextAllowedAt, cooldownUntil })
  };
}

module.exports = { createIgdbGate };
