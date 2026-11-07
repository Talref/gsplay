const { createHash } = require('node:crypto');
const PLACEHOLDER = 'Damme un attimo, ce sto a pensà…';
const FAILURE = 'Stavolta me so’ impicciato. Riprova tra poco.';
const ALLOWED_MENTIONS = { parse: [], repliedUser: false };
const hash = (text) => createHash('sha256').update(text).digest('hex');

function splitText(text, limit = 2000) {
  const parts = [];
  while (text.length > limit) {
    let end = limit;
    // Discord counts UTF-16 units; preserve surrogate pairs at split boundaries.
    if (/^[\uDC00-\uDFFF]$/.test(text[end])) end--;
    const newline = text.lastIndexOf('\n', end);
    if (newline > end / 2) end = newline + 1;
    parts.push(text.slice(0, end));
    text = text.slice(end);
  }
  if (text) parts.push(text);
  return parts;
}

function createMessages({
  job,
  channel,
  botId,
  save,
  authorize = async () => {},
  now = () => Date.now()
}) {
  let lastEdit = 0;
  let serial = Promise.resolve();
  function run(operation) {
    const result = serial.then(operation);
    serial = result.catch(() => undefined);
    return result;
  }
  async function persist(fields) {
    await save(fields);
    Object.assign(job, fields);
  }
  async function existing(id) {
    const message = await channel.messages.fetch(id).catch((error) => {
      if (error.code === 10008) throw new Error('response_deleted');
      throw error;
    });
    if (message.author.id !== botId) throw new Error('response_author_mismatch');
    return message;
  }
  async function sendPart(index, text) {
    await authorize();
    let intent = job.deliveryIntent;
    if (intent?.nonce) {
      if (intent.index !== index) throw new Error('delivery_state_invalid');
      // Inspect a bounded window only to reconcile this request's own reply, never as LLM context.
      const recent = await channel.messages.fetch({ after: job._id, limit: 100 });
      const matches = [...recent.values()].filter(
        (message) =>
          message.author.id === botId &&
          (String(message.nonce) === intent.nonce ||
            (message.reference?.messageId === job._id &&
              hash(message.content) === intent.hash &&
              message.createdTimestamp >= new Date(intent.at).getTime() - 1000))
      );
      if (matches.length > 1) throw new Error('delivery_uncertain');
      if (matches.length === 1) {
        await persist({ responseIds: [...job.responseIds, matches[0].id], deliveryIntent: null });
        return existing(matches[0].id);
      }
      // Discord nonce uniqueness only covers recent sends. Never blindly repost an old ambiguous send.
      if (now() - new Date(intent.at).getTime() > 120000) throw new Error('delivery_uncertain');
    } else {
      intent = {
        index,
        nonce: hash(`${job._id}:${index}`).slice(0, 25),
        hash: hash(text),
        at: new Date(now())
      };
      await persist({ deliveryIntent: intent });
    }
    await authorize();
    const message = await channel.send({
      content: text,
      nonce: intent.nonce,
      enforceNonce: true,
      allowedMentions: ALLOWED_MENTIONS,
      reply: { messageReference: job._id, failIfNotExists: true }
    });
    await persist({ responseIds: [...job.responseIds, message.id], deliveryIntent: null });
    return message;
  }
  async function part(index, text) {
    const id = job.responseIds[index];
    const message = id ? await existing(id) : await sendPart(index, text);
    if (message.content !== text) {
      await authorize();
      await message.edit({ content: text, allowedMentions: ALLOWED_MENTIONS });
    }
  }
  const ensure = () =>
    run(async () => {
      if (job.responseIds.length) {
        await existing(job.responseIds[0]);
        return;
      }
      await sendPart(0, PLACEHOLDER);
    });
  const render = (segments, { force = false } = {}) =>
    run(async () => {
      if (!force && now() - lastEdit < 1500) return;
      const parts = segments.flatMap((segment) => splitText(segment)).filter(Boolean);
      for (let index = 0; index < parts.length; index++) await part(index, parts[index]);
      if (parts.length) lastEdit = now();
    });
  const fail = () =>
    run(async () => {
      // Only edit known responses on failure; uncertainty must never create another bot reply.
      for (const [index, id] of job.responseIds.entries()) {
        const message = await existing(id);
        await authorize();
        await message.edit({
          content: index ? 'Risposta interrotta.' : FAILURE,
          allowedMentions: ALLOWED_MENTIONS
        });
      }
    });
  return { ensure, render, fail };
}

module.exports = { createMessages, splitText, PLACEHOLDER, FAILURE };
