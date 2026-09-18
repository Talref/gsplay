require('dotenv').config();
const { loadGsbotEnvironment } = require('./config');
const { createGsbotRuntime } = require('./runtime');

async function startGsbot({ environment = process.env, log = console } = {}) {
  const config = loadGsbotEnvironment(environment);
  const runtime = createGsbotRuntime({ config, log });
  await runtime.start();
  return runtime;
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
