const mongoose = require('mongoose');

const casualFridayRotationGameSchema = new mongoose.Schema({
  canonicalGameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalGameV2', required: true, index: true },
  displayTitle: { type: String, required: true, trim: true, maxlength: 512 }, artworkOverride: { type: String, trim: true, maxlength: 2048 }, info: { type: String, trim: true, maxlength: 4000 },
  status: { type: String, enum: ['active', 'retired'], default: 'active', required: true, index: true },
  playerCountMin: { type: Number, required: true, min: 1, max: 999 },
  playerCountMax: { type: Number, required: true, min: 1, max: 999 },
  playerCountLabel: { type: String, trim: true, maxlength: 128 },
  joinInstructions: { type: String, trim: true, maxlength: 4000 },
  hostMode: { type: String, enum: ['none', 'host_runs', 'streamable'], default: 'none', required: true },
  acquisitionKind: { type: String, enum: ['owned_store', 'external_store', 'free', 'web'], default: 'owned_store', required: true },
  acquisitionUrl: { type: String, trim: true, maxlength: 2048 },
  availabilityNote: { type: String, trim: true, maxlength: 1000 },
  itadGameId: { type: String, trim: true, maxlength: 256, index: true }, itadStatus: { type: String, enum: ['pending', 'verified', 'ambiguous', 'not_found', 'error', 'not_required'], default: 'pending', required: true, index: true }, itadCheckedAt: Date, itadError: { type: String, maxlength: 1000 }, itadTitle: { type: String, maxlength: 512 },
  itadOffer: {
    type: new mongoose.Schema({
      shop: { type: String, required: true, maxlength: 256 },
      url: { type: String, required: true, maxlength: 2048 },
      price: Number, currency: { type: String, maxlength: 8 },
      regularPrice: Number, discountPercent: Number, voucher: { type: String, trim: true, maxlength: 256 }, retrievedAt: { type: Date, required: true }
    }, { _id: false }),
    default: null
  },
  itadOfferCheckedAt: Date,
  itadOfferError: { type: String, maxlength: 1000 },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
  retiredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', default: null }, retiredAt: Date, retirementReason: { type: String, trim: true, maxlength: 1000 }
}, { timestamps: true, collection: 'casual_friday_rotation_games_v2' });
casualFridayRotationGameSchema.pre('validate', function validate(next) { if (this.playerCountMax < this.playerCountMin) this.invalidate('playerCountMax', 'must be at least playerCountMin'); if (['free', 'web', 'external_store'].includes(this.acquisitionKind) && !/^https:\/\//.test(this.acquisitionUrl || '')) this.invalidate('acquisitionUrl', 'is required for externally acquired games and must use HTTPS'); next(); });
casualFridayRotationGameSchema.index({ canonicalGameId: 1 }, { unique: true, partialFilterExpression: { status: 'active' }, name: 'active_rotation_canonical_game_unique' });
module.exports = mongoose.models.CasualFridayRotationGameV2 || mongoose.model('CasualFridayRotationGameV2', casualFridayRotationGameSchema);
