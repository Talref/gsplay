const mongoose = require('mongoose');
const casualFridayAuditSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
    actorUsernameSnapshot: { type: String, required: true, maxlength: 32 },
    kind: { type: String, required: true, index: true },
    rotationGameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CasualFridayRotationGameV2',
      index: true
    },
    playlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CasualFridayPlaylistV2',
      index: true
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CasualFridayEventV2',
      index: true
    },
    beforeVersion: Number,
    afterVersion: Number,
    details: { type: mongoose.Schema.Types.Mixed, default: undefined }
  },
  { timestamps: true, collection: 'casual_friday_audit_v2' }
);
casualFridayAuditSchema.index({ playlistId: 1, createdAt: -1 });
module.exports =
  mongoose.models.CasualFridayAuditV2 ||
  mongoose.model('CasualFridayAuditV2', casualFridayAuditSchema);
