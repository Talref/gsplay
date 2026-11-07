const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    _id: String,
    input: { type: String, required: true },
    output: { type: String, default: '' },
    // Visible assistant segments and final delivery text. No system prompt or reasoning is persisted.
    segments: { type: [String], default: [] },
    inferenceComplete: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true }
  },
  { collection: 'drracoon_content' }
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.models.DrRacoonContent || mongoose.model('DrRacoonContent', schema);
