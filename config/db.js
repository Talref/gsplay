//config/db.js
module.exports = {
    mongoURI: process.env.MONGO_URI || 'auth from .env'
  };