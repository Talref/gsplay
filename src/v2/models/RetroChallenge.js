const mongoose = require('mongoose');

const retroChallengeSchema = new mongoose.Schema({
  retroGameId: { type: Number, required: true, unique: true, min: 1 },
  title: { type: String, required: true, trim: true, maxlength: 512 },
  consoleName: { type: String, trim: true, maxlength: 256 },
  imageUrl: String,
  description: { type: String, trim: true, maxlength: 2_000 },
  active: { type: Boolean, default: false, required: true },
  activatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true }
}, { timestamps: true, collection: 'retro_challenges_v2' });

retroChallengeSchema.index({ active: 1 }, { unique: true, partialFilterExpression: { active: true } });

module.exports = mongoose.models.RetroChallengeV2 || mongoose.model('RetroChallengeV2', retroChallengeSchema);