const { Client, Events, GatewayIntentBits } = require('discord.js');
const Request = require('../core/models/DrRacoonRequest');
const { resolveAccess, revalidate } = require('./authorization');
const { createMessages } = require('./messages');

function createDrracoonClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });
}

function createDrracoonRuntime({
  config,
  client,
  queue,
  consumer,
  onReady = async () => {},
  onUnready = async () => {},
  onStop = async () => {},
  access = resolveAccess,
  checkAccess = revalidate,
  log = console
}) {
  let stopping = false;
  const handlers = new Set();
  async function handle(message) {
    if (
      stopping ||
      !message.guildId ||
      !config.guildIds.includes(message.guildId) ||
      message.author.bot
    )
      return;
    const botId = client.user?.id;
    if (!botId || message.author.id === botId) return;
    let replied;
    const reference = message.reference;
    if (
      reference?.messageId &&
      (!reference.channelId || reference.channelId === message.channelId) &&
      (!reference.guildId || reference.guildId === message.guildId) &&
      (!reference.type || reference.type === 0)
    ) {
      replied = await message.channel.messages.fetch(reference.messageId).catch(() => null);
    }
    if (!message.mentions?.users.has(botId) && replied?.author.id !== botId) return;
    const source = {
      id: message.id,
      guildId: message.guildId,
      channelId: message.channelId,
      authorId: message.author.id
    };
    let job;
    try {
      const { channel, scope } = await access(source, { config, client });
      source.scope = scope;
      if (replied?.author.id === botId) {
        source.parentRequestId = (
          await queue.parentForMessage({ ...source, messageId: replied.id })
        )?._id;
      }
      const input =
        message.content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim() || 'Ciao Dr. Racoon!';
      const admitted = await queue.admit(source, input);
      if (admitted.duplicate) return;
      job = admitted.job;
      const authorize = async () => {
        await queue.assertOwner(job);
        await checkAccess(job, { config, client });
      };
      const messages = createMessages({
        job,
        channel,
        botId,
        authorize,
        save: async (fields) => {
          const saved = await Request.findOneAndUpdate(
            {
              _id: job._id,
              status: 'admitting',
              leaseToken: job.leaseToken,
              leaseExpiresAt: { $gt: new Date() }
            },
            { $set: fields },
            { new: true }
          );
          if (!saved) throw new Error('lease_lost');
        }
      });
      await messages.ensure();
      await queue.activate(job._id);
      void consumer.tick();
    } catch (error) {
      if (!job && ['queue_full', 'rate_limited'].includes(error.message)) {
        await message
          .reply({
            content:
              error.message === 'queue_full'
                ? 'Qua c’è la fila! Riprova tra poco.'
                : 'Piano co’ le domande! Aspetta un minuto e riprova.',
            allowedMentions: { parse: [], repliedUser: false }
          })
          .catch(() => undefined);
      }
      // An admitted request is recovered from its durable admission lease.
      log.warn(`Dr. Racoon admission failed · request=${message.id}`);
    }
  }
  const receive = (message) => {
    const pending = handle(message)
      .catch(() => log.warn('Dr. Racoon trigger failed'))
      .finally(() => handlers.delete(pending));
    handlers.add(pending);
  };
  client.on(Events.MessageCreate, receive);
  client.on(Events.Error, () => log.warn('Dr. Racoon Discord client error'));
  client.on(
    Events.ShardDisconnect,
    () => void onUnready().catch(() => log.warn('Dr. Racoon readiness update failed'))
  );
  client.on(
    Events.ShardReconnecting,
    () => void onUnready().catch(() => log.warn('Dr. Racoon readiness update failed'))
  );
  client.on(Events.ShardResume, () => {
    if (client.isReady())
      void onReady().catch(() => log.warn('Dr. Racoon readiness update failed'));
  });
  async function start() {
    const ready = new Promise((resolve, reject) => {
      client.once(Events.ClientReady, async () => {
        try {
          for (const id of config.guildIds) await client.guilds.fetch(id);
          if (stopping) {
            resolve();
            return;
          }
          await onReady();
          consumer.start();
          log.info('Dr. Racoon ready');
          resolve();
        } catch {
          reject(new Error('discord_startup_failed'));
        }
      });
    });
    try {
      await client.login(config.token);
      await ready;
    } catch {
      await stop();
      throw new Error('Dr. Racoon Discord startup failed');
    }
  }
  async function stop() {
    if (stopping) return;
    stopping = true;
    await onUnready();
    client.off(Events.MessageCreate, receive);
    await Promise.all([...handlers]);
    await consumer.stop();
    client.destroy();
    await onStop();
  }
  return { start, stop, handle };
}

module.exports = { createDrracoonClient, createDrracoonRuntime };
