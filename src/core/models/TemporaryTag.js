const mongoose = require('mongoose');

const temporaryTagSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, maxlength: 20, index: true },
    discordRoleId: { type: String, required: true, maxlength: 20, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    normalizedName: { type: String, required: true, maxlength: 100 },
    buttonLabel: { type: String, required: true, trim: true, maxlength: 80 },
    expiresAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'deleting', 'deleted'],
      default: 'active',
      required: true,
      index: true
    },
    createdBy: { type: String, required: true, maxlength: 20 },
    deletedBy: { type: String, default: null, maxlength: 20 },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true, collection: 'temporary_tags' }
);

temporaryTagSchema.index(
  { guildId: 1, normalizedName: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['active', 'deleting'] } }
  }
);
temporaryTagSchema.index({ guildId: 1, status: 1, expiresAt: 1 });

module.exports = mongoose.models.TemporaryTag || mongoose.model('TemporaryTag', temporaryTagSchema);
