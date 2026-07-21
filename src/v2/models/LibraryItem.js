const mongoose = require('mongoose');

const PROVIDERS = ['steam', 'gog', 'epic', 'amazon'];
const MATCH_STATUSES = ['unmatched', 'auto_matched', 'manually_matched', 'ambiguous', 'ignored'];

const libraryItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true, index: true },
  provider: { type: String, enum: PROVIDERS, required: true, index: true },
  providerGameId: { type: String, required: true, trim: true, maxlength: 256 },
  providerTitle: { type: String, required: true, trim: true, maxlength: 512 },
  normalizedTitle: { type: String, required: true, trim: true, maxlength: 512, index: true },
  canonicalGameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalGameV2', default: null, index: true },
  matchStatus: { type: String, enum: MATCH_STATUSES, default: 'unmatched', required: true, index: true },
  matchConfidence: { type: Number, min: 0, max: 1 },
  matchMethod: { type: String, maxlength: 64 },
  source: { type: String, enum: ['api', 'upload', 'migration'], required: true },
  sourceImportId: { type: mongoose.Schema.Types.ObjectId, ref: 'SyncJobV2', default: null },
  firstSeenAt: { type: Date, default: Date.now, required: true },
  lastSeenAt: { type: Date, default: Date.now, required: true },
  removedAt: { type: Date, default: null, index: true },
  rawMetadata: { type: mongoose.Schema.Types.Mixed, default: undefined }
}, { timestamps: true, collection: 'library_items_v2', minimize: true });

libraryItemSchema.index(
  { userId: 1, provider: 1, providerGameId: 1 },
  { unique: true, partialFilterExpression: { removedAt: null }, name: 'active_provider_entitlement_unique' }
);
libraryItemSchema.index({ userId: 1, removedAt: 1, provider: 1 });

module.exports = mongoose.models.LibraryItemV2 || mongoose.model('LibraryItemV2', libraryItemSchema);
module.exports.PROVIDERS = PROVIDERS;
module.exports.MATCH_STATUSES = MATCH_STATUSES;