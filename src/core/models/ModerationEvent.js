const mongoose = require('mongoose');

const actionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'strike',
        'note',
        'kick',
        'ban',
        'unban',
        'timeout',
        'timeout_removed',
        'voice_mute',
        'voice_unmute'
      ]
    },
    previousUntil: { type: Date, default: null },
    until: { type: Date, default: null }
  },
  { _id: false }
);
const annotationSchema = new mongoose.Schema({
  authorId: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, immutable: true }
});
const moderationEventSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, immutable: true },
    targetId: { type: String, required: true, immutable: true },
    moderatorId: { type: String, default: null, immutable: true },
    type: { type: String, enum: ['strike', 'note', 'discord'], required: true, immutable: true },
    source: { type: String, enum: ['manual', 'discord'], required: true, immutable: true },
    reason: { type: String, default: null, immutable: true },
    occurredAt: { type: Date, required: true, immutable: true },
    discordAuditId: { type: String, immutable: true },
    actions: { type: [actionSchema], required: true, immutable: true },
    annotations: { type: [annotationSchema], default: [] }
  },
  { collection: 'moderation_events' }
);
// Original records are append-only; future annotations use $push without replacing history.
moderationEventSchema.pre('save', function () {
  if (!this.isNew && this.isModified()) throw new Error('Moderation events are append-only');
});
for (const operation of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace'
]) {
  moderationEventSchema.pre(operation, function () {
    const update = this.getUpdate();
    if (
      this.getOptions().upsert ||
      !update ||
      Object.keys(update).length !== 1 ||
      !update.$push ||
      Object.keys(update.$push).some((key) => key !== 'annotations')
    ) {
      throw new Error('Only appending moderation annotations is allowed');
    }
    const annotation = update.$push.annotations;
    if (
      annotation &&
      Object.keys(annotation).some((key) => key.startsWith('$')) &&
      (Object.keys(annotation).length !== 1 || !Array.isArray(annotation.$each))
    ) {
      throw new Error('Annotation appends cannot reorder or remove existing annotations');
    }
    this.setOptions({ runValidators: true });
  });
}
moderationEventSchema.index(
  { guildId: 1, discordAuditId: 1 },
  {
    unique: true,
    partialFilterExpression: { source: 'discord', discordAuditId: { $type: 'string' } }
  }
);
moderationEventSchema.index({ guildId: 1, targetId: 1, occurredAt: -1, _id: -1 });

module.exports =
  mongoose.models.ModerationEvent || mongoose.model('ModerationEvent', moderationEventSchema);
