const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    _id: String,
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    authorId: { type: String, required: true },
    parentRequestId: String,
    scope: { type: String, enum: ['user', 'staff'], required: true },
    status: {
      type: String,
      enum: ['admitting', 'queued', 'running', 'completed', 'failed'],
      required: true
    },
    responseIds: { type: [String], default: [] },
    deliveryIntent: { index: Number, nonce: String, at: Date },
    attempts: { type: Number, default: 0 },
    runAfter: { type: Date, default: Date.now },
    leaseToken: String,
    leaseExpiresAt: Date,
    deadline: { type: Date, required: true },
    failureCode: String,
    completedAt: Date,
    expiresAt: Date
  },
  { timestamps: true, collection: 'drracoon_requests' }
);
schema.index({ status: 1, runAfter: 1, leaseExpiresAt: 1 });
schema.index({ guildId: 1, authorId: 1, createdAt: 1 });
schema.index({ guildId: 1, channelId: 1, responseIds: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.models.DrRacoonRequest || mongoose.model('DrRacoonRequest', schema);
