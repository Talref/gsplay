const mongoose = require('mongoose');

const adminUserActionSchema = new mongoose.Schema({
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true, index: true },
  subjectUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true, index: true },
  subjectUsername: { type: String, required: true, trim: true, maxlength: 32 },
  kind: { type: String, enum: ['role_changed', 'user_deleted'], required: true, index: true },
  beforeRole: { type: String, enum: ['member', 'helper', 'admin'] },
  afterRole: { type: String, enum: ['member', 'helper', 'admin'] },
  reason: { type: String, trim: true, maxlength: 1000 },
  details: { type: mongoose.Schema.Types.Mixed, default: undefined }
}, { timestamps: true, collection: 'admin_user_actions_v2' });

adminUserActionSchema.index({ subjectUserId: 1, createdAt: -1 });

module.exports = mongoose.models.AdminUserActionV2 || mongoose.model('AdminUserActionV2', adminUserActionSchema);