const mongoose = require('mongoose');

const aliasSchema = new mongoose.Schema({
  provider: { type: String, enum: ['steam', 'gog', 'epic', 'amazon', 'igdb', 'legacy'], required: true, index: true },
  providerGameId: { type: String, trim: true, maxlength: 256 },
  normalizedProviderTitle: { type: String, required: true, trim: true, maxlength: 512, index: true },
  canonicalGameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalGameV2', required: true, index: true },
  matchType: { type: String, enum: ['provider_id', 'exact_alias', 'manual', 'fuzzy'], required: true },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
  reviewedAt: Date
}, { timestamps: true, collection: 'game_aliases_v2' });

aliasSchema.index({ provider: 1, providerGameId: 1 }, { unique: true, sparse: true });
aliasSchema.index({ provider: 1, normalizedProviderTitle: 1, canonicalGameId: 1 }, { unique: true });

module.exports = mongoose.models.GameAliasV2 || mongoose.model('GameAliasV2', aliasSchema);