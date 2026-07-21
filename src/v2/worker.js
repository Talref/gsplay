require('dotenv').config();
const { loadEnvironment } = require('./config/environment');
const { connectDatabase, disconnectDatabase } = require('./database');
const { claimNextJob, completeJob, createWorkerId, retryJob } = require('./jobs/jobService');
const { createJobHandlers } = require('./jobs/handlers');

async function startWorker({ pollMs = 1_000 } = {}) {
  const config = loadEnvironment();
  if (!config.workerEnabled) return null;
  await connectDatabase(config);
  const workerId = createWorkerId();
  const handlers = createJobHandlers(config);
  let stopping = false;
  const tick = async () => {
    if (stopping) return;
    const job = await claimNextJob(workerId);
    if (!job) return;
    const handler = handlers[job.kind];
    let result;
    try {
      result = handler ? await handler(job) : { failed: true, diagnostics: [{ code: 'handler_not_registered', message: `No worker handler is registered for ${job.kind}` }] };
    } catch (error) {
      result = { retryable: true, diagnostics: [{ code: 'worker_error', message: 'Worker handler failed unexpectedly' }] };
    }
    if (result.retryable) await retryJob(job, result);
    else await completeJob(job, result);
  };
  const timer = setInterval(() => tick().catch((error) => console.error('v2 worker tick failed', error)), pollMs);
  await tick();
  const shutdown = async () => { stopping = true; clearInterval(timer); await disconnectDatabase(); };
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  return { workerId, shutdown };
}
if (require.main === module) startWorker().catch((error) => { console.error(error); process.exit(1); });
module.exports = { startWorker };