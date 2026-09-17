require('dotenv').config();
const { loadEnvironment } = require('../core/config/environment');
const { createApp } = require('./app');
const { connectDatabase, disconnectDatabase } = require('../core/database');

async function start() {
  const config = loadEnvironment();
  await connectDatabase(config);
  const server = createApp(config).listen(config.port, config.host, () =>
    console.info(`GSPlay API listening on http://${config.host}:${config.port}`)
  );
  const shutdown = async () => {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return server;
}
if (require.main === module)
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
module.exports = { start };
