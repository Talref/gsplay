const mongoose = require('mongoose');

const metadataSchema = new mongoose.Schema({
  status: { type: String, enum: ['pending', 'complete', 'failed'], default: 'pending', required: true, index: true },
  attempts: { type: Number, default: 0, min: 0 },
  nextRetryAt: Date,
  lastSyncAt: Date,
  lastError: { type: String, maxlength: 1000 }
}, { _id: false });

const candidateSchema = new mongoose.Schema({
  igdbId: { type: Number, required: true },
  title: { type: String, required: true, maxlength: 512 },
  artwork: String,
  releaseDate: Date,
  platforms: [{ type: String, maxlength: 256 }],
  companies: [{ type: String, maxlength: 256 }],
  igdbUrl: String
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
  origin: { type: String, enum: ['provider_discovery', 'manual_catalogue'], default: 'provider_discovery', required: true, index: true },
  storeAvailability: { type: String, enum: ['store', 'independent'], default: 'store', required: true },
  metadataCandidates: { type: [candidateSchema], default: undefined },
  metadataReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
  metadataReviewedAt: Date,
  fieldLocks: [{ type: String, enum: ['canonicalTitle', 'summary', 'artwork', 'genres', 'platforms', 'releaseDate'] }],
  mergedIntoId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalGameV2', default: null, index: true },
  archivedAt: { type: Date, default: null, index: true },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
  archiveReason: { type: String, trim: true, maxlength: 1000 },
  hiddenAt: { type: Date, default: null, index: true },
  hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', default: null },
  metadata: { type: metadataSchema, default: () => ({}) }
}, { timestamps: true, collection: 'canonical_games_v2' });

canonicalGameSchema.index({ normalizedTitle: 1, releaseDate: 1 });
canonicalGameSchema.index({ canonicalTitle: 'text', alternativeTitles: 'text' });
canonicalGameSchema.index({ genres: 1 });
canonicalGameSchema.index({ platforms: 1 });

module.exports = mongoose.models.CanonicalGameV2 || mongoose.model('CanonicalGameV2', canonicalGameSchema);