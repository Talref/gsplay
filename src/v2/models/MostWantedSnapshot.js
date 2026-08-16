const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
    username: { type: String, required: true, trim: true, maxlength: 32 }
  },
  { _id: false }
);

const gameSchema = new mongoose.Schema(
  {
    canonicalGameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CanonicalGameV2',
      required: true
    },
    title: { type: String, required: true, trim: true, maxlength: 512 },
    artwork: String,
    steamAppIds: [{ type: String, trim: true, maxlength: 32 }],
    wishlistCount: { type: Number, required: true, min: 1 },
    ownerCount: { type: Number, required: true, min: 0 },
    wishlistedBy: { type: [memberSchema], default: [] },
    ownedBy: { type: [memberSchema], default: [] }
  },
  { _id: false }
);

const profileCacheSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
    steamId: { type: String, required: true, match: /^\d{17}$/ },
    appIds: [{ type: String, required: true, trim: true, maxlength: 32 }],
    fetchedAt: { type: Date, required: true }
  },
  { _id: false }
);

const mostWantedSnapshotSchema = new mongoose.Schema(
  {
    key: { type: String, enum: ['current'], default: 'current', required: true, unique: true },
    aggregationVersion: { type: Number, default: 4, min: 1, required: true },
    generatedAt: { type: Date, default: null },
    lastAttemptAt: { type: Date, default: null },
    lastError: {
      code: { type: String, maxlength: 64 },
      message: { type: String, maxlength: 500 }
    },
    profilesEligible: { type: Number, default: 0, min: 0 },
    profilesIncluded: { type: Number, default: 0, min: 0 },
    profilesUnavailable: { type: Number, default: 0, min: 0 },
    profilesCached: { type: Number, default: 0, min: 0 },
    unmatchedAppCount: { type: Number, default: 0, min: 0 },
    profileCaches: { type: [profileCacheSchema], default: [] },
    games: { type: [gameSchema], default: [] }
  },
  { timestamps: true, collection: 'most_wanted_snapshots_v2' }
);

module.exports =
  mongoose.models.MostWantedSnapshotV2 ||
  mongoose.model('MostWantedSnapshotV2', mostWantedSnapshotSchema);
