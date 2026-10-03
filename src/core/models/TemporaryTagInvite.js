const mongoose = require('mongoose');

const temporaryTagInviteSchema = new mongoose.Schema(
  {
    tagId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TemporaryTag',
      required: true,
      index: true
    },
    guildId: { type: String, required: true, maxlength: 20, index: true },
    channelId: { type: String, required: true, maxlength: 20 },
    messageId: { type: String, required: true, maxlength: 20 },
    createdBy: { type: String, required: true, maxlength: 20 },
    disabledAt: { type: Date, default: null }
  },
  { timestamps: true, collection: 'temporary_tag_invites' }
);

temporaryTagInviteSchema.index({ tagId: 1, messageId: 1 }, { unique: true });
temporaryTagInviteSchema.index({ tagId: 1, disabledAt: 1 });

module.exports =
  mongoose.models.TemporaryTagInvite ||
  mongoose.model('TemporaryTagInvite', temporaryTagInviteSchema);
