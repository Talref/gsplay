const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema(
  {
    rotationGameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CasualFridayRotationGameV2',
      required: true
    },
    canonicalGameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CanonicalGameV2',
      required: true
    },
    displayTitle: { type: String, required: true, maxlength: 512 },
    artwork: { type: String, default: null, maxlength: 2048 },
    playerCountMin: { type: Number, required: true },
    playerCountMax: { type: Number, required: true },
    playerCountLabel: { type: String, default: '', maxlength: 128 }
  },
  { _id: false }
);

const casualFridayEventSchema = new mongoose.Schema(
  {
    weekKey: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: {
      type: String,
      enum: ['open', 'draft', 'published', 'completed', 'cancelled'],
      required: true,
      default: 'open',
      index: true
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true, index: true },
    votingClosesAt: { type: Date, required: true, index: true },
    candidates: { type: [candidateSchema], required: true },
    playlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CasualFridayPlaylistV2',
      default: null
    },
    version: { type: Number, default: 1, min: 1, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', default: null },
    cancelledAt: Date,
    cancellationReason: { type: String, trim: true, maxlength: 1000 },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', default: null },
    completedAt: Date
  },
  { timestamps: true, collection: 'casual_friday_events_v2' }
);

casualFridayEventSchema.index({ status: 1, endsAt: 1 });

module.exports =
  mongoose.models.CasualFridayEventV2 ||
  mongoose.model('CasualFridayEventV2', casualFridayEventSchema);
