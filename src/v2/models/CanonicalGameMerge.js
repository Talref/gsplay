const mongoose = require('mongoose');

const canonicalGameMergeSchema = new mongoose.Schema({
  sourceGameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalGameV2', required: true, unique: true },
  targetGameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalGameV2', required: true, index: true },
  mergedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
  reason: { type: String, trim: true, maxlength: 1000 }
}, { timestamps: true, collection: 'canonical_game_merges_v2' });

module.exports = mongoose.models.CanonicalGameMergeV2 || mongoose.model('CanonicalGameMergeV2', canonicalGameMergeSchema);