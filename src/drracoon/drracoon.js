require('dotenv').config();
const fs = require('node:fs/promises');
const { loadDrracoonEnvironment } = require('./config');
const { connectDatabase, disconnectDatabase } = require('../core/database');
const { createDrRacoonQueue } = require('../core/jobs/drRacoonQueue');
const { createDrracoonClient, createDrracoonRuntime } = require('./runtime');
const { createConsumer } = require('./queue');
const { createInference } = require('./inference');
const { compilePrompt } = require('./prompts');

async function startDrracoon({ environment = process.env, log = console } = {}) {
  const readyFile = environment.DRRACOON_READY_FILE;
  const removeReady = async () => {
    if (readyFile) await fs.rm(readyFile, { force: true });
  };
  await removeReady();
  const config = loadDrracoonEnvironment(environment);
  if (!config.enabled) {
    log.info('Dr. Racoon disabled');
    return null;
  }
  await compilePrompt('user');
  if (config.staffChannelIds.length && config.staffRoleIds.length) await compilePrompt('staff');
  await connectDatabase(config);
  const client = createDrracoonClient();
  const queue = createDrRacoonQueue({ limit: config.queueLimit, guildIds: config.guildIds });
  const consumer = createConsumer({
    config,
    client,
    queue,
    infer: createInference({ config }),
    log
  });
  const runtime = createDrracoonRuntime({
    config,
    client,
    queue,
    consumer,
    log,
    onReady: async () => {
      if (readyFile) await fs.writeFile(readyFile, `${process.pid}\n`, { mode: 0o600 });
    },
    onUnready: removeReady,
    onStop: disconnectDatabase
  });
  try {
    await runtime.start();
    return runtime;
  } catch (error) {
    await removeReady();
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  let runtime,
    stopping = false;
  const started = startDrracoon().then((value) => {
    runtime = value;
  });
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 40000);
    try {
      await started;
      await runtime?.stop();
      clearTimeout(deadline);
    } catch {
      clearTimeout(deadline);
      process.exitCode = 1;
    }
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  started.catch(() => {
    console.error(
      'Dr. Racoon startup failed; check configuration, prompt files and Discord access.'
    );
    process.exitCode = 1;
  });
}

module.exports = { startDrracoon };
