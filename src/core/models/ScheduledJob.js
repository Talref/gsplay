const mongoose = require('mongoose');

const scheduledJobSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true, maxlength: 100 },
    payload: { type: mongoose.Schema.Types.Mixed, default: undefined, select: false },
    runAt: { type: Date, required: true, index: true },
    nextAttemptAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['scheduled', 'preparing', 'ready', 'delivering', 'completed', 'failed', 'canceled'],
      default: 'scheduled',
      required: true,
      index: true
    },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 6, min: 1, max: 20 },
    dedupeKey: { type: String, required: true, unique: true, maxlength: 256 },
    workerId: String,
    leaseExpiresAt: Date,
    lastError: String,
    deliveryMessageId: String,
    completedAt: Date,
    canceledAt: Date
  },
  { timestamps: true, collection: 'scheduled_jobs' }
);

scheduledJobSchema.index({ status: 1, runAt: 1, leaseExpiresAt: 1 });
scheduledJobSchema.index({ status: 1, nextAttemptAt: 1, leaseExpiresAt: 1 });

module.exports = mongoose.models.ScheduledJob || mongoose.model('ScheduledJob', scheduledJobSchema);
