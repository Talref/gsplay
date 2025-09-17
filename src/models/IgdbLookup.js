const mongoose = require('mongoose');

const lookupSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['genres', 'platforms', 'gameModes'],
    unique: true
  },
  data: {
    type: Map,
    of: String,
    required: true
  }, // id -> name mapping
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  version: {
    type: String,
    default: 'v4'
  } // IGDB API version
});

// Note: Index is automatically created by unique: true on type field

// Pre-save middleware to update lastUpdated
lookupSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

const IgdbLookup = mongoose.model('IgdbLookup', lookupSchema);

module.exports = IgdbLookup;
