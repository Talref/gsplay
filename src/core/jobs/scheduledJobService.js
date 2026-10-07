const ScheduledJob = require('../models/ScheduledJob');

const ACTIVE_STATUSES = ['scheduled', 'preparing', 'ready', 'delivering'];

async function enqueueScheduledJob({ type, payload, runAt, dedupeKey, maxAttempts }) {
  const revived = await ScheduledJob.findOneAndUpdate(
    { dedupeKey, status: { $in: ['canceled', 'failed'] } },
    {
      $set: {
        type,
        payload,
        runAt,
        nextAttemptAt: runAt,
        status: 'scheduled',
        attempts: 0,
        completedAt: null,
        canceledAt: null,
        deliveryMessageId: null,
        workerId: null,
        leaseExpiresAt: null,
        lastError: null,
        ...(maxAttempts ? { maxAttempts } : {})
      }
    },
    { new: true }
  ).select('+payload');
  if (revived) return revived;
  return ScheduledJob.findOneAndUpdate(
    { dedupeKey },
    {
      $setOnInsert: {
        type,
        payload,
        runAt,
        nextAttemptAt: runAt,
        dedupeKey,
        status: 'scheduled',
        ...(maxAttempts ? { maxAttempts } : {})
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).select('+payload');
}

async function cancelScheduledJobs(filter) {
  const now = new Date();
  return ScheduledJob.updateMany(
    { ...filter, status: { $in: ACTIVE_STATUSES } },
    {
      $set: {
        status: 'canceled',
        canceledAt: now,
        workerId: null,
        leaseExpiresAt: null
      }
    }
  );
}

async function claimDueScheduledJob(workerId, leaseMs = 60_000) {
  const now = new Date();
  return ScheduledJob.findOneAndUpdate(
    {
      $or: [
        { status: 'scheduled', runAt: { $lte: now } },
        { status: 'preparing', leaseExpiresAt: { $lte: now } }
      ]
    },
    {
      $set: {
        status: 'preparing',
        workerId,
        leaseExpiresAt: new Date(now.getTime() + leaseMs)
      }
    },
    { sort: { runAt: 1, createdAt: 1 }, new: true }
  ).select('+payload');
}

async function markScheduledJobReady(job) {
  return ScheduledJob.findOneAndUpdate(
    { _id: job._id, status: 'preparing', workerId: job.workerId },
    {
      $set: {
        status: 'ready',
        nextAttemptAt: new Date(),
        workerId: null,
        leaseExpiresAt: null,
        lastError: null
      }
    },
    { new: true }
  ).select('+payload');
}

async function failScheduledJobPreparation(job, error) {
  return ScheduledJob.findOneAndUpdate(
    { _id: job._id, status: 'preparing', workerId: job.workerId },
    {
      $set: {
        status: 'failed',
        completedAt: new Date(),
        workerId: null,
        leaseExpiresAt: null,
        lastError: error.message
      }
    },
    { new: true }
  );
}

async function claimReadyScheduledJob(
  deliveryId,
  { types, guildId, guildIds, leaseMs = 60_000 } = {}
) {
  const now = new Date();
  const typeFilter = types?.length ? { type: { $in: types } } : {};
  const guildFilter = guildIds
    ? { 'payload.guildId': { $in: guildIds } }
    : guildId
      ? { 'payload.guildId': guildId }
      : {};
  return ScheduledJob.findOneAndUpdate(
    {
      ...typeFilter,
      ...guildFilter,
      $or: [
        { status: 'ready', nextAttemptAt: { $lte: now } },
        { status: 'delivering', leaseExpiresAt: { $lte: now } }
      ]
    },
    {
      $set: {
        status: 'delivering',
        workerId: deliveryId,
        leaseExpiresAt: new Date(now.getTime() + leaseMs)
      },
      $inc: { attempts: 1 }
    },
    { sort: { nextAttemptAt: 1, runAt: 1 }, new: true }
  ).select('+payload');
}

async function completeScheduledJob(job, { deliveryMessageId } = {}) {
  return ScheduledJob.findOneAndUpdate(
    { _id: job._id, status: 'delivering', workerId: job.workerId },
    {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        deliveryMessageId,
        workerId: null,
        leaseExpiresAt: null,
        lastError: null
      }
    },
    { new: true }
  );
}

function scheduledRetryDelayMs(attempt) {
  return Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, attempt - 1));
}

async function retryScheduledJob(job, error) {
  const terminal = job.attempts >= job.maxAttempts;
  const now = new Date();
  return ScheduledJob.findOneAndUpdate(
    { _id: job._id, status: 'delivering', workerId: job.workerId },
    {
      $set: {
        status: terminal ? 'failed' : 'ready',
        completedAt: terminal ? now : null,
        nextAttemptAt: terminal
          ? job.nextAttemptAt
          : new Date(now.getTime() + scheduledRetryDelayMs(job.attempts)),
        workerId: null,
        leaseExpiresAt: null,
        lastError: error.message
      }
    },
    { new: true }
  );
}

module.exports = {
  ACTIVE_STATUSES,
  cancelScheduledJobs,
  claimDueScheduledJob,
  claimReadyScheduledJob,
  completeScheduledJob,
  enqueueScheduledJob,
  failScheduledJobPreparation,
  markScheduledJobReady,
  retryScheduledJob,
  scheduledRetryDelayMs
};
