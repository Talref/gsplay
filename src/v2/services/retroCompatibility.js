const RetroChallenge = require('../models/RetroChallenge');
const { monthWindow } = require('./retroService');

async function backfillRetroChallenges() {
  const rows = await RetroChallenge.collection
    .find({
      $or: [
        { monthKey: { $exists: false } },
        { sequence: { $exists: false } },
        { status: { $exists: false } },
        { scoringStartsAt: { $exists: false } },
        { scoringEndsAt: { $exists: false } }
      ]
    })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();
  if (!rows.length) return 0;
  const existing = await RetroChallenge.collection
    .aggregate([
      { $match: { monthKey: { $type: 'string' }, sequence: { $type: 'number' } } },
      { $group: { _id: '$monthKey', sequence: { $max: '$sequence' } } }
    ])
    .toArray();
  const sequences = new Map(existing.map((item) => [item._id, item.sequence]));
  const operations = rows.map((row) => {
    const reference = row.activatedAt || row.createdAt || new Date();
    const window = monthWindow(reference);
    const targetMonth = row.monthKey || window.monthKey;
    const sequence = row.sequence || (sequences.get(targetMonth) || 0) + 1;
    sequences.set(targetMonth, Math.max(sequences.get(targetMonth) || 0, sequence));
    return {
      updateOne: {
        filter: { _id: row._id },
        update: {
          $set: {
            monthKey: targetMonth,
            sequence,
            version: row.version || 1,
            status: row.status || (row.active ? 'active' : 'completed'),
            scoringStartsAt: row.scoringStartsAt || window.startsAt,
            scoringEndsAt: row.scoringEndsAt || window.endsAt,
            activatedAt: row.activatedAt || reference
          }
        }
      }
    };
  });
  await RetroChallenge.collection.bulkWrite(operations, { ordered: true });
  return operations.length;
}

module.exports = { backfillRetroChallenges };
