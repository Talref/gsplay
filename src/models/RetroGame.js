// src/models/RetroGame.js
const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  achievementId: { type: Number, required: true },
  badgeId: { type: String, required: true },      // For /Badge/{badgeId}.png
  name: { type: String, required: true },
  description: { type: String, required: true },
  points: { type: Number, required: true },
  softcoreOwners: [{ type: String }],             // Array of ULIDs
  hardcoreOwners: [{ type: String }]              // Array of ULIDs
}, { _id: false });

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true },       // ULID from RA
  username: { type: String, required: true },     // RA username
  completionPercentage: { type: Number, required: true, default: 0 },
  totalPoints: { type: Number, required: true, default: 0 }
}, { _id: false });

const retroGameSchema = new mongoose.Schema({
  gameId: { type: Number, required: true },       // RA game ID
  gameName: { type: String, required: true },     // Cached game name
  consoleName: { type: String, required: true },  // Cached console
  gomId: { type: String, required: true, unique: true }, // "2025-09.1" format
  isActive: { type: Boolean, required: true, default: false },

  // Game images from RetroAchievements
  imageIcon: { type: String },                     // Icon image path
  imageTitle: { type: String },                    // Title screen image path
  imageIngame: { type: String },                   // In-game image path
  imageBoxArt: { type: String },                   // Box art image path

  // Admin-editable content
  description: { type: String },                   // Game description (admin editable)

  // Static achievement data
  achievements: [achievementSchema],

  // Playing users
  users: [userSchema]
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Ensure only one active game at a time
retroGameSchema.pre('save', async function(next) {
  if (this.isActive && this.isModified('isActive')) {
    // Deactivate all other games when setting this one as active
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, isActive: true },
      { isActive: false }
    );
  }
  next();
});

// Index for efficient queries
retroGameSchema.index({ isActive: 1 });

const RetroGame = mongoose.model('RetroGame', retroGameSchema);

module.exports = RetroGame;
