const crypto = require('node:crypto');
const {
  claimReadyScheduledJob,
  completeScheduledJob,
  retryScheduledJob
} = require('../../core/jobs/scheduledJobService');
const { TEMPORARY_TAG_EXPIRATION_JOB_TYPE } = require('../../core/services/temporaryTagService');

function createTemporaryTagExpirationDelivery({ cleanup, log = console, pollMs = 1_000 }) {
  const deliveryId = `gsbot-tag-${process.pid}-${crypto.randomUUID()}`;
  let timer;
  let running = false;
  let stopping = false;

  async function deliver(job) {
    const tag = await cleanup.cleanup(job.payload?.tagId);
    const completed = await completeScheduledJob(job);
    if (!completed) throw new Error(`Temporary tag expiration lease was lost for ${job._id}`);
    log.info(
      `GSbot temporary tag expiration complete · tag=${job.payload?.tagId} · status=${tag?.status || 'missing'}`
    );
  }

  async function drain() {
    if (stopping || running) return;
    running = true;
    try {
      while (!stopping) {
        const job = await claimReadyScheduledJob(deliveryId, {
          types: [TEMPORARY_TAG_EXPIRATION_JOB_TYPE]
        });
        if (!job) return;
        try {
          await deliver(job);
        } catch (error) {
          const persisted = await retryScheduledJob(job, error);
          log.error(
            `GSbot temporary tag expiration failed · job=${job.id} · status=${persisted?.status || 'lease-lost'}: ${error.message}`
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

module.exports = { createTemporaryTagExpirationDelivery };
