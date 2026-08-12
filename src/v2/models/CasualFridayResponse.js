const mongoose = require('mongoose');

const casualFridayResponseSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CasualFridayEventV2',
      required: true,
      index: true
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true, index: true },
    rsvp: { type: String, enum: ['yes', 'maybe', 'no'], default: undefined },
    voteRotationGameIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CasualFridayRotationGameV2' }],
      default: [],
      validate: {
        validator: (values) => values.length <= 5 && new Set(values.map(String)).size === values.length,
        message: 'Select no more than five unique games'
      }
    }
  },
  { timestamps: true, collection: 'casual_friday_responses_v2' }
);

casualFridayResponseSchema.index({ eventId: 1, userId: 1 }, { unique: true });

module.exports =
  mongoose.models.CasualFridayResponseV2 ||
  mongoose.model('CasualFridayResponseV2', casualFridayResponseSchema);
