const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const providerAccountSchema = new mongoose.Schema({
  steamId: { type: String, trim: true },
  linkedAt: Date,
  lastSyncedAt: Date
}, { _id: false });

const retroAchievementsSchema = new mongoose.Schema({
  username: { type: String, trim: true },
  userId: { type: String, trim: true },
  linkedAt: Date
}, { _id: false });

const userSchema = new mongoose.Schema({
  usernameNormalized: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
  usernameDisplay: { type: String, required: true, trim: true, minlength: 3, maxlength: 32 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['member', 'admin'], default: 'member', required: true, index: true },
  steamAccount: providerAccountSchema,
  retroAchievements: retroAchievementsSchema
}, { timestamps: true, collection: 'users_v2' });

userSchema.statics.normalizeUsername = (username) => String(username || '').trim().toLocaleLowerCase('en-US');
userSchema.statics.hashPassword = (password, rounds = 12) => bcrypt.hash(password, rounds);
userSchema.methods.verifyPassword = function verifyPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};
userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    username: this.usernameDisplay,
    role: this.role,
    steamAccount: this.steamAccount ? { steamId: this.steamAccount.steamId, linkedAt: this.steamAccount.linkedAt, lastSyncedAt: this.steamAccount.lastSyncedAt } : null,
    retroAchievements: this.retroAchievements ? { username: this.retroAchievements.username, linkedAt: this.retroAchievements.linkedAt } : null,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.models.UserV2 || mongoose.model('UserV2', userSchema);