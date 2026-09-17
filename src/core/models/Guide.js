const mongoose = require('mongoose');

const guideSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, enum: ['guide'], unique: true },
    markdown: { type: String, maxlength: 100_000, default: '' }
  },
  { timestamps: true, collection: 'guides_v2' }
);

module.exports = mongoose.models.GuideV2 || mongoose.model('GuideV2', guideSchema);
