require('dotenv').config();
const fs = require('node:fs/promises');
const { loadGsbotEnvironment } = require('./config');
const { connectDatabase, disconnectDatabase } = require('../core/database');
const { createBirthdayDelivery } = require('./features/birthdayDelivery');
const { createTemporaryTagCleanup } = require('./features/temporaryTagCleanup');
const {
  createTemporaryTagExpirationDelivery
} = require('./features/temporaryTagExpirationDelivery');
const { createGsbotClient, createGsbotRuntime } = require('./runtime');

async function removeReadyFile(path) {
  if (!path) return;
  try {
    await fs.unlink(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function startGsbot({ environment = process.env, log = console } = {}) {
  const readyFile = environment.GSBOT_READY_FILE?.trim();
  await removeReadyFile(readyFile);
  const config = loadGsbotEnvironment(environment);
  await connectDatabase(config);
  const client = createGsbotClient();
  const birthdayDelivery = createBirthdayDelivery({ client, log });
  const temporaryTagCleanup = createTemporaryTagCleanup({ client, log });
  const temporaryTagExpirationDelivery = createTemporaryTagExpirationDelivery({
    cleanup: temporaryTagCleanup,
    log
  });
  const delivery = {
    start() {
      birthdayDelivery.start();
      temporaryTagExpirationDelivery.start();
    },
    async stop() {
      await Promise.all([birthdayDelivery.stop(), temporaryTagExpirationDelivery.stop()]);
    }
  };
  const runtime = createGsbotRuntime({
    config,
    client,
    delivery,
    interactionContext: { temporaryTagCleanup },
    log,
    onReady: readyFile ? () => fs.writeFile(readyFile, `${process.pid}\n`, { mode: 0o600 }) : null,
    onStop: async () => {
      await removeReadyFile(readyFile);
      await disconnectDatabase();
    }
  });
  try {
    await runtime.start();
    return runtime;
  } catch (error) {
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  let runtime;
  let stopping = false;
  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    try {
      await runtime?.stop();
      console.info(`GSbot shutdown complete · signal=${signal}`);
      process.exit(0);
    } catch (error) {
      console.error(`GSbot shutdown failed: ${error.message}`);
      process.exit(1);
    }
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  startGsbot()
    .then((startedRuntime) => {
      runtime = startedRuntime;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = { startGsbot };
