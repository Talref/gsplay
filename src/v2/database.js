const mongoose = require('mongoose');

async function connectDatabase(config) {
  await mongoose.connect(config.mongoUri);
  return mongoose.connection;
}
async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
function isDatabaseReady() { return mongoose.connection.readyState === 1; }
module.exports = { connectDatabase, disconnectDatabase, isDatabaseReady };