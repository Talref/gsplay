const mongoose = require('mongoose');
const casualFridayPlaylistSchema = new mongoose.Schema(
  {
    weekKey: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: {
      type: String,
      enum: ['draft', 'published', 'completed', 'cancelled'],
      default: 'draft',
      required: true,
      index: true
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true, index: true },
    version: { type: Number, default: 1, min: 1, required: true },
    notes: { type: String, trim: true, maxlength: 4000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', default: null },
    publishedAt: Date,
    completedAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', default: null },
    cancelledAt: Date,
    cancellationReason: { type: String, trim: true, maxlength: 1000 }
  },
  { timestamps: true, collection: 'casual_friday_playlists_v2' }
);
casualFridayPlaylistSchema.index({ status: 1, endsAt: 1 });
module.exports =
  mongoose.models.CasualFridayPlaylistV2 ||
  mongoose.model('CasualFridayPlaylistV2', casualFridayPlaylistSchema);
