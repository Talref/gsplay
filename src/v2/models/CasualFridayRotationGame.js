const mongoose = require('mongoose');

const casualFridayRotationGameSchema = new mongoose.Schema({
  canonicalGameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalGameV2', required: true, unique: true, index: true },
  status: { type: String, enum: ['active', 'retired'], default: 'active', required: true, index: true },
  playerCountMin: { type: Number, required: true, min: 1, max: 999 },
  playerCountMax: { type: Number, required: true, min: 1, max: 999 },
  playerCountLabel: { type: String, trim: true, maxlength: 128 },
  joinInstructions: { type: String, trim: true, maxlength: 4000 },
  hostMode: { type: String, enum: ['none', 'host_runs', 'streamable'], default: 'none', required: true },
  availabilityOverride: { type: String, enum: ['none', 'free'], default: 'none', required: true },
  acquisitionUrlOverride: { type: String, trim: true, maxlength: 2048 },
  availabilityNote: { type: String, trim: true, maxlength: 1000 },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
  retiredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', default: null }, retiredAt: Date, retirementReason: { type: String, trim: true, maxlength: 1000 }
}, { timestamps: true, collection: 'casual_friday_rotation_games_v2' });
casualFridayRotationGameSchema.pre('validate', function validate(next) { if (this.playerCountMax < this.playerCountMin) this.invalidate('playerCountMax', 'must be at least playerCountMin'); if (this.availabilityOverride === 'free' && !/^https:\/\//.test(this.acquisitionUrlOverride || '')) this.invalidate('acquisitionUrlOverride', 'is required for free games and must use HTTPS'); next(); });
module.exports = mongoose.models.CasualFridayRotationGameV2 || mongoose.model('CasualFridayRotationGameV2', casualFridayRotationGameSchema);