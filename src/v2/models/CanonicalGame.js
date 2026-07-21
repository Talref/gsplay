const mongoose = require('mongoose');

const metadataSchema = new mongoose.Schema({
  status: { type: String, enum: ['pending', 'complete', 'not_found', 'retryable_error', 'permanent_error'], default: 'pending', required: true, index: true },
  attempts: { type: Number, default: 0, min: 0 },
  nextRetryAt: Date,
  lastSyncAt: Date,
  lastError: { type: String, maxlength: 1000 }
}, { _id: false });

const canonicalGameSchema = new mongoose.Schema({
  igdbId: { type: Number, unique: true, sparse: true, index: true },
  canonicalTitle: { type: String, required: true, trim: true, maxlength: 512 },
  normalizedTitle: { type: String, required: true, trim: true, maxlength: 512, index: true },
  alternativeTitles: [{ type: String, trim: true, maxlength: 512 }],
  summary: { type: String, maxlength: 10000 },
  genres: [{ type: String, trim: true }],
  platforms: [{ type: String, trim: true }],
  gameModes: [{ type: String, trim: true }],
  rating: { type: Number, min: 0, max: 100 },
  artwork: String,
  releaseDate: Date,
  videos: [{ type: String, trim: true }],
  companies: [{ type: String, trim: true }],
  igdbUrl: String,
  metadata: { type: metadataSchema, default: () => ({}) }
}, { timestamps: true, collection: 'canonical_games_v2' });

canonicalGameSchema.index({ normalizedTitle: 1, releaseDate: 1 });
canonicalGameSchema.index({ canonicalTitle: 'text', alternativeTitles: 'text' });
canonicalGameSchema.index({ genres: 1 });
canonicalGameSchema.index({ platforms: 1 });

module.exports = mongoose.models.CanonicalGameV2 || mongoose.model('CanonicalGameV2', canonicalGameSchema);