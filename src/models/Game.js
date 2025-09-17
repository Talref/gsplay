const mongoose = require('mongoose');

const storeLinkSchema = new mongoose.Schema({
  platform: { type: String, required: true },
  url: { type: String, required: true }
}, { _id: false });

const ownerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  platforms: [{ type: String, required: true }] // Which platforms this user owns it on
}, { _id: false });

const gameSchema = new mongoose.Schema({
  // Primary linking key - normalized game name
  name: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // IGDB identifiers
  igdbId: {
    type: Number,
    sparse: true, // Allows null values while maintaining uniqueness
    index: true
  },

  // Resolved human-readable metadata
  description: String,
  genres: [String],
  availablePlatforms: [String], // Platforms the game is available on
  gameModes: [String], // Single-player, Co-op, Multiplayer, etc.

  // Ratings and media
  rating: Number, // IGDB rating (0-100)
  artwork: String, // Cover image URL
  videos: [String], // YouTube video IDs or URLs

  // Store links for purchasing
  storeLinks: [storeLinkSchema],

  // Reverse lookup - users who own this game
  owners: [ownerSchema],

  // Metadata
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
gameSchema.index({ name: 1 }); // Already indexed via unique
gameSchema.index({ igdbId: 1 });
gameSchema.index({ 'owners.userId': 1 }); // For querying games owned by a user
gameSchema.index({ genres: 1 }); // For filtering by genre
gameSchema.index({ availablePlatforms: 1 }); // For filtering by platform
gameSchema.index({ rating: -1 }); // For sorting by rating

// Update lastUpdated on save
gameSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Static method to normalize game names for consistent linking
gameSchema.statics.normalizeGameName = function(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
