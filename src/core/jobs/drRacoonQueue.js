const { randomUUID } = require('node:crypto');
const Request = require('../models/DrRacoonRequest');
const Content = require('../models/DrRacoonContent');
const ACTIVE = ['admitting', 'queued', 'running'];
const DAY = 86400000;

// Admission is serialized in the single supported runtime. Durable claims remain atomic.
// A second service instance is not supported; this needs no MongoDB replica set/transactions.
function createDrRacoonQueue({ limit = 20, guildIds, now = () => new Date() }) {
  let admission = Promise.resolve();
  async function admit(source, input) {
    const operation = admission.then(async () => {
      const existing = await Request.findById(source.id);
      if (existing) return { job: existing, duplicate: true };
      if (!guildIds.includes(source.guildId)) throw new Error('guild_not_allowed');
      const count = await Request.countDocuments({ status: { $in: ACTIVE } });
      if (count >= limit) throw new Error('queue_full');
      const user = { guildId: source.guildId, authorId: source.authorId };
      const [active, recent] = await Promise.all([
        Request.countDocuments({ ...user, status: { $in: ACTIVE } }),
        Request.countDocuments({ ...user, createdAt: { $gte: new Date(now().getTime() - 60000) } })
      ]);
      if (active >= 2 || recent >= 6) throw new Error('rate_limited');
      // Write content first: a crash can leave only a TTL-cleaned orphan, never a job without input.
      await Content.updateOne(
        { _id: source.id },
        {
          $setOnInsert: {
            input,
            expiresAt: new Date(now().getTime() + 7 * DAY)
          }
        },
        { upsert: true }
      );
      const job = await Request.create({
        _id: source.id,
        guildId: source.guildId,
        channelId: source.channelId,
        authorId: source.authorId,
        scope: source.scope,
        parentRequestId: source.parentRequestId,
        status: 'admitting',
        runAfter: now(),
        leaseExpiresAt: new Date(now().getTime() + 30000),
        deadline: new Date(now().getTime() + 10 * 60000)
      });
      return { job, duplicate: false };
    });
    admission = operation.catch(() => undefined);
    return operation;
  }
  async function activate(id) {
    return Request.findOneAndUpdate(
      { _id: id, status: 'admitting' },
      {
        $set: { status: 'queued', leaseExpiresAt: null }
      },
      { new: true }
    );
  }
  async function claim(leaseMs = 30000) {
    return Request.findOneAndUpdate(
      {
        guildId: { $in: guildIds },
        $or: [
          { status: 'queued', runAfter: { $lte: now() } },
          { status: { $in: ['running', 'admitting'] }, leaseExpiresAt: { $lte: now() } }
        ]
      },
      {
        $set: {
          status: 'running',
          leaseToken: randomUUID(),
          leaseExpiresAt: new Date(now().getTime() + leaseMs)
        },
        $inc: { attempts: 1 }
      },
      { sort: { createdAt: 1, _id: 1 }, new: true }
    );
  }
  const owned = (job) => ({
    _id: job._id,
    status: 'running',
    leaseToken: job.leaseToken,
    leaseExpiresAt: { $gt: now() }
  });
  async function update(job, fields) {
    const updated = await Request.findOneAndUpdate(owned(job), { $set: fields }, { new: true });
    if (!updated) throw new Error('lease_lost');
    return updated;
  }
  const renew = (job, leaseMs = 30000) =>
    update(job, { leaseExpiresAt: new Date(now().getTime() + leaseMs) });
  const finish = (job, failureCode = null) =>
    update(job, {
      status: failureCode ? 'failed' : 'completed',
      failureCode,
      completedAt: now(),
      expiresAt: new Date(now().getTime() + 30 * DAY),
      leaseExpiresAt: null
    });
  const retry = (job, failureCode) =>
    update(job, {
      status: 'queued',
      failureCode,
      leaseToken: null,
      leaseExpiresAt: null,
      runAfter: new Date(now().getTime() + Math.min(30000, 1000 * 2 ** job.attempts))
    });
  async function parentForMessage({ guildId, channelId, scope, messageId }) {
    return Request.findOne({
      guildId,
      channelId,
      scope,
      responseIds: messageId,
      status: 'completed'
    });
  }
  async function history(job, maxTurns = 20) {
    const turns = [],
      seen = new Set([job._id]);
    let id = job.parentRequestId;
    while (id && turns.length < maxTurns && !seen.has(id)) {
      seen.add(id);
      const ancestor = await Request.findOne({
        _id: id,
        guildId: job.guildId,
        channelId: job.channelId,
        scope: job.scope,
        status: 'completed'
      });
      if (!ancestor) break;
      const body = await Content.findOne({ _id: id, expiresAt: { $gt: now() } });
      if (!body || !body.inferenceComplete) break;
      turns.unshift({ input: body.input, output: body.output });
      id = ancestor.parentRequestId;
    }
    return turns;
  }
  return { admit, activate, claim, update, renew, finish, retry, parentForMessage, history };
}

module.exports = { createDrRacoonQueue };
