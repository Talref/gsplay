const Request = require('../core/models/DrRacoonRequest');
const Content = require('../core/models/DrRacoonContent');
const { createMessages, PLACEHOLDER } = require('./messages');
const { revalidate } = require('./authorization');
const { compilePrompt } = require('./prompts');

function createConsumer({
  config,
  client,
  queue,
  infer,
  compiler = compilePrompt,
  access = revalidate,
  log = console
}) {
  let stopping = false,
    polling = false,
    timer;
  const running = new Map();
  async function processJob(job, controller) {
    let messages,
      visible = false;
    const authorize = async () => {
      controller.signal.throwIfAborted();
      await queue.assertOwner(job);
      return access(job, { config, client });
    };
    const heartbeat = setInterval(() => {
      queue.renew(job).catch(() => controller.abort());
    }, 10000);
    try {
      const { channel } = await authorize();
      messages = createMessages({
        job,
        channel,
        botId: client.user.id,
        authorize,
        save: (fields) => queue.update(job, fields)
      });
      if (job.deadline <= new Date() || job.attempts > 3) throw new Error('request_expired');
      if (job.parentRequestId) {
        const parent = await Request.findOne({
          _id: job.parentRequestId,
          guildId: job.guildId,
          channelId: job.channelId,
          scope: job.scope
        });
        if (parent && ['admitting', 'queued', 'running'].includes(parent.status)) {
          await queue.defer(job);
          return;
        }
      }
      // Confirm the source still exists; do not infer from a deleted request.
      await channel.messages.fetch(job._id);
      await messages.ensure();
      const body = await Content.findOne({ _id: job._id, expiresAt: { $gt: new Date() } });
      if (!body) throw new Error('content_expired');
      if (!body.inferenceComplete) {
        if (job.attempts > 1) {
          const existing = await channel.messages.fetch(job.responseIds[0]);
          if (body.segments.length || existing.content !== PLACEHOLDER)
            throw new Error('inference_interrupted');
        }
        const prompt = await compiler(job.scope);
        const history = await queue.history(job);
        await authorize();
        const result = await infer({
          prompt,
          input: body.input,
          history,
          context: {
            guildId: job.guildId,
            channelId: job.channelId,
            scope: job.scope,
            requestId: job._id
          },
          signal: controller.signal,
          authorize,
          onText: async (text, prior) => {
            if (!text) return;
            controller.signal.throwIfAborted();
            visible = true;
            await messages.render([...prior, text]);
          },
          onTurn: async (segments, complete) => {
            await authorize();
            const persisted = await Content.updateOne(
              { _id: job._id, expiresAt: { $gt: new Date() } },
              {
                $set: { segments, output: segments.join('\n\n'), inferenceComplete: complete }
              }
            );
            if (!persisted.matchedCount) throw new Error('content_expired');
            if (segments.length) visible = true;
            await messages.render(segments, { force: true });
          }
        });
        // Supports injected inference implementations while preserving the same persistence contract.
        await authorize();
        await Content.updateOne(
          { _id: job._id },
          { $set: { segments: result.segments, output: result.output, inferenceComplete: true } }
        );
        await messages.render(result.segments, { force: true });
      } else {
        await messages.render(body.segments, { force: true });
      }
      await authorize();
      await queue.finish(job);
      log.info(`Dr. Racoon completed · request=${job._id} · guild=${job.guildId}`);
    } catch (error) {
      const code = safeCode(error);
      try {
        await queue.assertOwner(job);
        if (stopping) await queue.defer(job);
        else if (
          !visible &&
          ['provider_unavailable', 'request_timeout'].includes(code) &&
          job.attempts < 3
        ) {
          await queue.retry(job, code);
        } else {
          await messages?.fail().catch(() => undefined);
          await queue.finish(job, code);
        }
      } catch {
        /* A new owner recovers the job; never overwrite its state. */
      }
      log.warn(`Dr. Racoon request failed · request=${job._id} · code=${code}`);
    } finally {
      clearInterval(heartbeat);
    }
  }
  async function tick() {
    if (polling || stopping) return;
    polling = true;
    try {
      while (!stopping && running.size < config.maxConcurrent) {
        const job = await queue.claim();
        if (!job) break;
        const controller = new AbortController();
        const promise = processJob(job, controller).finally(() => running.delete(job._id));
        running.set(job._id, { controller, promise });
      }
    } catch {
      log.warn('Dr. Racoon queue poll failed');
    } finally {
      polling = false;
    }
  }
  function start() {
    if (timer) return;
    timer = setInterval(() => void tick(), 1000);
    void tick();
  }
  async function stop() {
    stopping = true;
    clearInterval(timer);
    while (polling) await new Promise((resolve) => setTimeout(resolve, 10));
    for (const { controller } of running.values()) controller.abort();
    await Promise.all([...running.values()].map(({ promise }) => promise));
  }
  async function idle() {
    await Promise.all([...running.values()].map(({ promise }) => promise));
  }
  return { start, stop, tick, idle };
}

function safeCode(error) {
  const codes = new Set([
    'guild_not_allowed',
    'channel_not_allowed',
    'channel_access_denied',
    'member_not_allowed',
    'authorization_changed',
    'lease_lost',
    'request_expired',
    'content_expired',
    'inference_interrupted',
    'provider_unavailable',
    'provider_rejected',
    'provider_empty',
    'provider_protocol',
    'provider_interrupted',
    'provider_incomplete',
    'provider_response_limit',
    'request_timeout',
    'request_cancelled',
    'context_limit',
    'output_limit',
    'tool_round_limit',
    'response_deleted',
    'delivery_uncertain',
    'delivery_state_invalid',
    'response_author_mismatch'
  ]);
  if (codes.has(error.message)) return error.message;
  if ([10008, 10003].includes(error.code)) return 'discord_deleted';
  if ([50001, 50013].includes(error.code)) return 'discord_permission';
  return 'request_failed';
}

module.exports = { createConsumer, safeCode };
