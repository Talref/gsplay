// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const gameSchema = new mongoose.Schema({
  name: { type: String, required: true },
  platform: { type: String, required: true },   // "steam" | "gog" | "epic" | "amazon"
  platformId: { type: String },                 // appid, gogid, epicid...
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  password: { type: String, required: true },
  steamId: { type: String },
  isAdmin: { type: Boolean, required: true, default: false },
  games: [gameSchema],
});

// Hash the password before saving the user
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Compare password for login
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;