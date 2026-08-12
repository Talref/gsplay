const mongoose = require('mongoose');

const casualFridayGameProposalSchema = new mongoose.Schema(
  {
    canonicalGameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CanonicalGameV2',
      required: true,
      unique: true,
      index: true
    },
    proposedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' }],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
      index: true
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', default: null },
    reviewedAt: { type: Date, default: null },
    adminNote: { type: String, trim: true, maxlength: 1000, default: '' },
    rotationGameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CasualFridayRotationGameV2',
      default: null
    }
  },
  { timestamps: true, collection: 'casual_friday_game_proposals_v2' }
);

casualFridayGameProposalSchema
  .path('proposedBy')
  .validate(
    (values) => new Set(values.map(String)).size === values.length,
    'proposedBy must contain unique users'
  );

module.exports =
  mongoose.models.CasualFridayGameProposalV2 ||
  mongoose.model('CasualFridayGameProposalV2', casualFridayGameProposalSchema);
