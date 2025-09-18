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
  // Primary linking key - exact game name from platform APIs
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
  releaseDate: Date, // Release date from IGDB
  videos: [String], // Video IDs for embedding
  publishers: [String], // Game publishers/developers
  igdbUrl: String, // Direct link to IGDB page

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

// Additional indexes for performance (name and igdbId already indexed via schema options)
gameSchema.index({ 'owners.userId': 1 }); // For querying games owned by a user
gameSchema.index({ genres: 1 }); // For filtering by genre
gameSchema.index({ availablePlatforms: 1 }); // For filtering by platform
gameSchema.index({ rating: -1 }); // For sorting by rating

// Update lastUpdated on save
gameSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Game names are stored exactly as provided by platform APIs
// No normalization needed - platforms provide consistent naming

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
