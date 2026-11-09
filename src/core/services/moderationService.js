const ModerationEvent = require('../models/ModerationEvent');

async function recordDiscordEvent(event) {
  try {
    await ModerationEvent.create(event);
    return true;
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.discordAuditId) return false;
    throw error;
  }
}

function recordManualEvent({ guildId, targetId, moderatorId, type, reason }) {
  if (!['strike', 'note'].includes(type)) throw new Error('Invalid manual moderation event');
  if (!reason?.trim()) throw new Error('Reason/message is required');
  return ModerationEvent.create({
    guildId,
    targetId,
    moderatorId,
    type,
    reason,
    source: 'manual',
    occurredAt: new Date(),
    actions: [{ type }],
    annotations: []
  });
}

async function moderationHistory(guildId, targetId) {
  const filter = { guildId, targetId };
  const [counts, recent, notes, total] = await Promise.all([
    ModerationEvent.aggregate([
      { $match: filter },
      { $unwind: '$actions' },
      { $group: { _id: '$actions.type', count: { $sum: 1 } } }
    ]),
    ModerationEvent.find(filter).sort({ occurredAt: -1, _id: -1 }).limit(8).lean(),
    ModerationEvent.find({ ...filter, type: 'note' })
      .sort({ occurredAt: -1, _id: -1 })
      .limit(3)
      .lean(),
    ModerationEvent.countDocuments(filter)
  ]);
  return {
    counts: Object.fromEntries(counts.map((row) => [row._id, row.count])),
    recent,
    notes,
    total
  };
}

module.exports = { recordDiscordEvent, recordManualEvent, moderationHistory };
