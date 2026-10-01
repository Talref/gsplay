const crypto = require('node:crypto');
const Birthday = require('../../core/models/Birthday');
const GsbotGuildConfig = require('../../core/models/GsbotGuildConfig');
const {
  claimReadyScheduledJob,
  completeScheduledJob,
  retryScheduledJob
} = require('../../core/jobs/scheduledJobService');
const {
  BIRTHDAY_JOB_TYPE,
  renderBirthdayMessage,
  scheduleBirthday
} = require('../../core/services/birthdayService');

function createBirthdayDelivery({ client, log = console, pollMs = 1_000 }) {
  const deliveryId = `gsbot-${process.pid}-${crypto.randomUUID()}`;
  let timer;
  let running = false;
  let stopping = false;

  async function deliver(job) {
    const { guildId, discordUserId } = job.payload || {};
    const [birthday, guildConfig] = await Promise.all([
      Birthday.findOne({ guildId, discordUserId }),
      GsbotGuildConfig.findOne({ guildId })
    ]);
    if (!birthday) {
      await completeScheduledJob(job);
      return;
    }
    const channelId = guildConfig?.channels?.general;
    if (!channelId) throw new Error(`GSbot general channel is not configured for guild ${guildId}`);
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased() || !channel.send)
      throw new Error(`GSbot general channel ${channelId} is not text-based`);
    const message = await channel.send({
      content: renderBirthdayMessage(discordUserId),
      allowedMentions: { parse: [], users: [discordUserId], repliedUser: false },
      nonce: job._id.toString(),
      enforceNonce: true
    });
    const completed = await completeScheduledJob(job, { deliveryMessageId: message.id });
    if (!completed) throw new Error(`Birthday delivery lease was lost for ${job._id}`);
    try {
      await scheduleBirthday(birthday);
    } catch (error) {
      log.error(
        `GSbot next birthday schedule failed · guild=${guildId} · user=${discordUserId}: ${error.message}`
      );
    }
    log.info(
      `GSbot birthday delivered · guild=${guildId} · user=${discordUserId} · channel=${channelId}`
    );
  }

  async function drain() {
    if (stopping || running) return;
    running = true;
    try {
      while (!stopping) {
        const job = await claimReadyScheduledJob(deliveryId, { types: [BIRTHDAY_JOB_TYPE] });
        if (!job) return;
        try {
          await deliver(job);
        } catch (error) {
          const persisted = await retryScheduledJob(job, error);
          log.error(
            `GSbot birthday delivery failed · job=${job.id} · status=${persisted?.status || 'lease-lost'}: ${error.message}`
          );
        }
      }
    } finally {
      running = false;
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => void drain(), pollMs);
    void drain();
  }

  async function stop() {
    stopping = true;
    clearInterval(timer);
    while (running) await new Promise((resolve) => setTimeout(resolve, 10));
  }

  return { deliver, drain, start, stop };
}

module.exports = { createBirthdayDelivery };
