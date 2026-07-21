const crypto = require('node:crypto');
const SyncJob = require('../models/SyncJob');

function createWorkerId() {
  return `${process.env.HOSTNAME || 'local'}-${process.pid}-${crypto.randomUUID()}`;
}

async function enqueueJob({ userId, provider, kind, payload, idempotencyKey }) {
  return SyncJob.findOneAndUpdate(
    { idempotencyKey },
    { $setOnInsert: { userId, provider, kind, payload, idempotencyKey, status: 'queued' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function ensureMetadataJob(canonicalGame, { userId, reason = 'discovered' } = {}) {
  if (!canonicalGame || !['pending', 'retryable_error'].includes(canonicalGame.metadata?.status)) return null;
  const canonicalGameId = canonicalGame._id.toString();
  const active = await SyncJob.exists({ provider: 'igdb', kind: 'metadata_enrichment', 'payload.canonicalGameId': canonicalGameId, status: { $in: ['queued', 'running'] } });
  if (active) return null;
  const attempt = Number(canonicalGame.metadata?.attempts || 0);
  return enqueueJob({ userId, provider: 'igdb', kind: 'metadata_enrichment', payload: { canonicalGameId, reason }, idempotencyKey: `igdb-enrich:${canonicalGameId}:${attempt}` });
}

async function claimNextJob(workerId, leaseMs = 60_000) {
  const now = new Date();
  const readyFilter = {
    $or: [
      { status: 'queued', runAfter: { $lte: now } },
      { status: 'running', leaseExpiresAt: { $lte: now } }
    ]
  };
  const claim = (filter) => SyncJob.findOneAndUpdate(
    filter,
    {
      $set: { status: 'running', workerId, leaseExpiresAt: new Date(now.getTime() + leaseMs), startedAt: now },
      $inc: { attempts: 1 }
    },
    { sort: { runAfter: 1, createdAt: 1 }, new: true }
  ).select('+payload');

  // Keep member-triggered imports and provider syncs responsive when
  // background metadata work has accumulated.
  return (await claim({ ...readyFilter, kind: { $ne: 'metadata_enrichment' } })) || claim(readyFilter);
}

async function completeJob(job, { diagnostics = [], counts = {}, failed = false } = {}) {
  const status = failed ? 'failed' : diagnostics.length ? 'completed_with_errors' : 'completed';
  return SyncJob.findOneAndUpdate(
    { _id: job._id, status: 'running', workerId: job.workerId },
    { $set: { status, diagnostics, counts: { ...job.counts.toObject(), ...counts }, completedAt: new Date(), leaseExpiresAt: null } },
    { new: true }
  );
}

function retryDelayMs(attempt) {
  return Math.min(60_000, 1_000 * (2 ** Math.max(0, attempt - 1)));
}

async function retryJob(job, { diagnostics = [], counts = {} } = {}) {
  const terminal = job.attempts >= job.maxAttempts;
  const status = terminal ? 'failed' : 'queued';
  const now = new Date();
  const update = {
    status,
    diagnostics,
    counts: { ...job.counts.toObject(), ...counts },
    completedAt: terminal ? now : null,
    runAfter: terminal ? job.runAfter : new Date(now.getTime() + retryDelayMs(job.attempts)),
    leaseExpiresAt: null,
    workerId: null
  };
  return SyncJob.findOneAndUpdate(
    { _id: job._id, status: 'running', workerId: job.workerId },
    { $set: update },
    { new: true }
  );
}

module.exports = { claimNextJob, completeJob, createWorkerId, enqueueJob, ensureMetadataJob, retryDelayMs, retryJob };