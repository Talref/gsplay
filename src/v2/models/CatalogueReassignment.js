const mongoose = require('mongoose');

const catalogueReassignmentSchema = new mongoose.Schema({
  sourceGameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalGameV2', required: true, index: true },
  targetGameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalGameV2', required: true, index: true },
  provider: { type: String, enum: ['steam', 'gog', 'epic', 'amazon'], required: true, index: true },
  providerGameId: { type: String, required: true, trim: true, maxlength: 256 },
  providerTitles: [{ type: String, trim: true, maxlength: 512 }],
  activeEntitlementCount: { type: Number, required: true, min: 0 },
  affectedUserCount: { type: Number, required: true, min: 0 },
  reassignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
  reason: { type: String, required: true, trim: true, maxlength: 1000 }
}, { timestamps: true, collection: 'catalogue_reassignments_v2' });

catalogueReassignmentSchema.index({ sourceGameId: 1, provider: 1, providerGameId: 1, createdAt: -1 });

module.exports = mongoose.models.CatalogueReassignmentV2 || mongoose.model('CatalogueReassignmentV2', catalogueReassignmentSchema);