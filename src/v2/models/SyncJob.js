const mongoose = require('mongoose');

const syncJobSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', index: true },
  provider: { type: String, enum: ['steam', 'gog', 'epic', 'amazon', 'igdb', 'retroachievements'], required: true, index: true },
  kind: { type: String, enum: ['upload', 'provider_sync', 'metadata_enrichment', 'reconciliation'], required: true, index: true },
  status: { type: String, enum: ['queued', 'running', 'completed', 'completed_with_errors', 'failed'], default: 'queued', required: true, index: true },
  idempotencyKey: { type: String, required: true, unique: true, maxlength: 256 },
  payload: { type: mongoose.Schema.Types.Mixed, default: undefined, select: false },
  counts: {
    discovered: { type: Number, default: 0 }, created: { type: Number, default: 0 }, updated: { type: Number, default: 0 }, removed: { type: Number, default: 0 }, matched: { type: Number, default: 0 }, ambiguous: { type: Number, default: 0 }, failed: { type: Number, default: 0 }
  },
  diagnostics: [{ code: String, message: String, itemReference: String }],
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3, min: 1, max: 10 },
  runAfter: { type: Date, default: Date.now, index: true },
  startedAt: Date,
  completedAt: Date,
  workerId: String,
  leaseExpiresAt: Date
}, { timestamps: true, collection: 'sync_jobs_v2' });

syncJobSchema.index({ status: 1, runAfter: 1, leaseExpiresAt: 1 });

module.exports = mongoose.models.SyncJobV2 || mongoose.model('SyncJobV2', syncJobSchema);