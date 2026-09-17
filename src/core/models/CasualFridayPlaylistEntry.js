const mongoose = require('mongoose');
const keyOfferSchema = new mongoose.Schema(
  {
    price: { type: Number, required: true, min: 0.01, max: 10000 },
    currency: { type: String, required: true, default: 'EUR', enum: ['EUR'] },
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    updatedAt: { type: Date, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true }
  },
  { _id: false }
);
const movieSchema = new mongoose.Schema(
  {
    tmdbId: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    overview: { type: String, trim: true, maxlength: 4000, default: '' },
    posterUrl: { type: String, trim: true, maxlength: 2048, default: null },
    rating: { type: Number, min: 0, max: 10, default: null },
    runtimeMinutes: { type: Number, min: 1, max: 1440, default: null },
    tmdbUrl: { type: String, required: true, trim: true, maxlength: 2048 }
  },
  { _id: false }
);
const casualFridayPlaylistEntrySchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: ['game', 'movie'], default: 'game' },
    playlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CasualFridayPlaylistV2',
      required: true,
      index: true
    },
    rotationGameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CasualFridayRotationGameV2',
      required() {
        return this.type === 'game';
      }
    },
    canonicalGameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CanonicalGameV2',
      required() {
        return this.type === 'game';
      }
    },
    position: { type: Number, required: true, min: 1 },
    selectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
    infoOverride: { type: String, trim: true, maxlength: 4000 },
    keyOffer: { type: keyOfferSchema, default: undefined },
    snapshots: {
      type: mongoose.Schema.Types.Mixed,
      required() {
        return this.type === 'game';
      }
    },
    movie: {
      type: movieSchema,
      required() {
        return this.type === 'movie';
      },
      default: undefined
    }
  },
  { timestamps: true, collection: 'casual_friday_playlist_entries_v2' }
);
casualFridayPlaylistEntrySchema.index(
  { playlistId: 1, rotationGameId: 1 },
  { unique: true, partialFilterExpression: { type: 'game' } }
);
casualFridayPlaylistEntrySchema.index({ playlistId: 1, position: 1 }, { unique: true });
module.exports =
  mongoose.models.CasualFridayPlaylistEntryV2 ||
  mongoose.model('CasualFridayPlaylistEntryV2', casualFridayPlaylistEntrySchema);
