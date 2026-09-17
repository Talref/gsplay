const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema(
  {
    achievementId: { type: Number, required: true },
    badgeId: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 512 },
    description: { type: String, trim: true, maxlength: 2_000 },
    points: { type: Number, required: true, min: 0 },
    displayOrder: { type: Number, default: 0 }
  },
  { _id: false }
);

const retroChallengeSchema = new mongoose.Schema(
  {
    retroGameId: { type: Number, required: true, min: 1 },
    monthKey: { type: String, match: /^\d{4}-\d{2}$/ },
    sequence: { type: Number, min: 1 },
    version: { type: Number, default: 1, min: 1, required: true },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
      index: true
    },
    title: { type: String, required: true, trim: true, maxlength: 512 },
    consoleName: { type: String, trim: true, maxlength: 256 },
    imageUrl: String,
    description: { type: String, trim: true, maxlength: 2_000 },
    achievements: { type: [achievementSchema], default: [] },
    scoringStartsAt: Date,
    scoringEndsAt: Date,
    active: { type: Boolean, default: false, required: true },
    activatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', default: null },
    activatedAt: Date,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', default: null },
    completedAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', default: null },
    cancelledAt: Date,
    cancellationReason: { type: String, trim: true, maxlength: 1_000 },
    lastRefreshAt: Date,
    refreshSummary: { type: mongoose.Schema.Types.Mixed, default: undefined }
  },
  { timestamps: true, collection: 'retro_challenges_v2' }
);

retroChallengeSchema.index(
  { active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);
retroChallengeSchema.index(
  { monthKey: 1, sequence: 1 },
  { unique: true, partialFilterExpression: { monthKey: { $type: 'string' } } }
);
retroChallengeSchema.index({ status: 1, scoringEndsAt: 1 });

module.exports =
  mongoose.models.RetroChallengeV2 || mongoose.model('RetroChallengeV2', retroChallengeSchema);
