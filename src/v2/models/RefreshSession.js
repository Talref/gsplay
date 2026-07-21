const mongoose = require('mongoose');

const refreshSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true },
  revokedAt: Date,
  replacedBySessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'RefreshSessionV2' },
  userAgent: { type: String, maxlength: 512 },
  ipAddress: { type: String, maxlength: 64 }
}, { timestamps: true, collection: 'refresh_sessions_v2' });

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.RefreshSessionV2 || mongoose.model('RefreshSessionV2', refreshSessionSchema);