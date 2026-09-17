const mongoose = require('mongoose');

const unlockSchema = new mongoose.Schema(
  {
    achievementId: { type: Number, required: true },
    earnedAt: { type: Date, required: true },
    hardcore: { type: Boolean, default: false, required: true },
    points: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const retroChallengeProgressSchema = new mongoose.Schema(
  {
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RetroChallengeV2',
      required: true,
      index: true
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true, index: true },
    usernameSnapshot: { type: String, required: true, maxlength: 32 },
    retroUsernameSnapshot: { type: String, required: true, maxlength: 32 },
    score: { type: Number, default: 0, required: true, min: 0 },
    completionPercentage: { type: Number, default: 0, required: true, min: 0, max: 100 },
    unlockedCount: { type: Number, default: 0, required: true, min: 0 },
    hardcoreCount: { type: Number, default: 0, required: true, min: 0 },
    unlocks: { type: [unlockSchema], default: [] },
    lastRefreshedAt: Date,
    lastError: { type: String, maxlength: 512 }
  },
  { timestamps: true, collection: 'retro_challenge_progress_v2' }
);

retroChallengeProgressSchema.index({ challengeId: 1, userId: 1 }, { unique: true });
retroChallengeProgressSchema.index({ challengeId: 1, score: -1, completionPercentage: -1 });

module.exports =
  mongoose.models.RetroChallengeProgressV2 ||
  mongoose.model('RetroChallengeProgressV2', retroChallengeProgressSchema);
