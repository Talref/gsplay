const mongoose = require('mongoose');

const steamAppCacheSchema = new mongoose.Schema(
  {
    providerGameId: { type: String, required: true, trim: true, maxlength: 32, unique: true },
    providerTitle: { type: String, trim: true, maxlength: 512, default: null },
    normalizedTitle: { type: String, trim: true, maxlength: 512, default: null },
    found: { type: Boolean, required: true },
    checkedAt: { type: Date, required: true }
  },
  { timestamps: true, collection: 'steam_app_cache_v2' }
);

steamAppCacheSchema.index({ checkedAt: 1 });

module.exports =
  mongoose.models.SteamAppCacheV2 || mongoose.model('SteamAppCacheV2', steamAppCacheSchema);
