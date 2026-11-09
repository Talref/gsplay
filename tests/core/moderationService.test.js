const ModerationEvent = require('../../src/core/models/ModerationEvent');
const {
  recordManualEvent,
  recordDiscordEvent,
  moderationHistory,
  latestModerationEvents
} = require('../../src/core/services/moderationService');

afterEach(() => ModerationEvent.deleteMany({}));
const manual = {
  guildId: 'guild',
  targetId: 'user',
  moderatorId: 'staff',
  type: 'strike',
  reason: 'Original reason'
};

test('manual strikes and notes are independent append-only events with unique IDs and empty annotations', async () => {
  const strike = await recordManualEvent(manual);
  const note = await recordManualEvent({ ...manual, type: 'note', reason: 'Note text' });
  expect(strike.id).not.toBe(note.id);
  expect(strike.annotations).toEqual([]);
  expect(note.annotations).toEqual([]);
  await expect(
    ModerationEvent.updateOne({ _id: strike.id }, { $set: { reason: 'Changed' } })
  ).rejects.toThrow('Only appending');
  await expect(ModerationEvent.replaceOne({ _id: strike.id }, manual)).rejects.toThrow(
    'Only appending'
  );
  await ModerationEvent.updateOne(
    { _id: strike.id },
    { $push: { annotations: { authorId: 'staff', message: 'Follow-up' } } }
  );
  const stored = await ModerationEvent.findById(strike.id);
  expect(stored.reason).toBe('Original reason');
  expect(stored.annotations[0]).toMatchObject({ authorId: 'staff', message: 'Follow-up' });
  expect(stored.annotations[0].id).toBeTruthy();
  expect(stored.annotations[0].createdAt).toBeInstanceOf(Date);
});

test('concurrent Discord writes deduplicate within guild, preserving original data', async () => {
  await ModerationEvent.init();
  const event = {
    ...manual,
    type: 'discord',
    source: 'discord',
    occurredAt: new Date(),
    discordAuditId: 'audit',
    actions: [{ type: 'ban' }]
  };
  expect(
    (await Promise.all(Array.from({ length: 5 }, () => recordDiscordEvent(event)))).filter(Boolean)
  ).toHaveLength(1);
  expect(await recordDiscordEvent({ ...event, guildId: 'other' })).toBe(true);
  expect(await recordDiscordEvent({ ...event, reason: 'Changed' })).toBe(false);
  expect((await ModerationEvent.findOne({ guildId: 'guild' })).reason).toBe('Original reason');
});

test('summary counts individual Discord actions and returns note text, scoped by guild and target', async () => {
  await recordManualEvent(manual);
  await recordManualEvent({ ...manual, type: 'note', reason: 'Visible note' });
  await recordManualEvent({ ...manual, targetId: 'another' });
  await recordManualEvent({ ...manual, guildId: 'another' });
  await recordDiscordEvent({
    ...manual,
    type: 'discord',
    source: 'discord',
    occurredAt: new Date(),
    discordAuditId: 'audit',
    actions: [{ type: 'timeout' }, { type: 'voice_mute' }]
  });
  const history = await moderationHistory('guild', 'user');
  expect(history.counts).toEqual({ strike: 1, note: 1, timeout: 1, voice_mute: 1 });
  expect(history.total).toBe(3);
  expect(history.notes[0].reason).toBe('Visible note');
  expect(history.recent).toHaveLength(3);
});

test('bounds history and notes while keeping full counts', async () => {
  for (let i = 0; i < 12; i++)
    await recordManualEvent({ ...manual, type: 'note', reason: `Note ${i}` });
  const history = await moderationHistory('guild', 'user');
  expect(history.total).toBe(12);
  expect(history.recent).toHaveLength(8);
  expect(history.notes).toHaveLength(3);
  expect(history.notes[0].reason).toBe('Note 11');
});

test('latest guild events include all targets and sources, ordered by event time and limited to ten', async () => {
  const order = [6, 1, 10, 0, 8, 2, 11, 3, 9, 4, 7, 5];
  for (const i of order) {
    const type = i % 3 === 0 ? 'discord' : i % 3 === 1 ? 'strike' : 'note';
    await ModerationEvent.create({
      guildId: 'guild',
      targetId: `target-${i}`,
      moderatorId: 'staff',
      type,
      source: type === 'discord' ? 'discord' : 'manual',
      reason: `Event ${i}`,
      occurredAt: new Date(Date.UTC(2026, 10, 9, 12, i)),
      actions: [{ type: type === 'discord' ? 'ban' : type }],
      ...(type === 'discord' ? { discordAuditId: `audit-${i}` } : {})
    });
  }
  await recordManualEvent({ ...manual, guildId: 'other', reason: 'Excluded guild' });
  const events = await latestModerationEvents('guild');
  expect(events.map((event) => event.reason)).toEqual(
    Array.from({ length: 10 }, (_, index) => `Event ${11 - index}`)
  );
  expect(new Set(events.map((event) => event.targetId)).size).toBe(10);
  expect(new Set(events.map((event) => event.type))).toEqual(
    new Set(['discord', 'strike', 'note'])
  );
  expect(events.every((event) => event.guildId === 'guild')).toBe(true);
  expect(await latestModerationEvents('empty')).toEqual([]);
});

test('latest events with equal timestamps use descending event IDs as a stable tiebreaker', async () => {
  const occurredAt = new Date('2026-11-09T12:00:00Z');
  const first = await ModerationEvent.create({
    ...manual,
    source: 'manual',
    occurredAt,
    actions: [{ type: 'strike' }]
  });
  const second = await ModerationEvent.create({
    ...manual,
    source: 'manual',
    occurredAt,
    actions: [{ type: 'strike' }]
  });
  expect((await latestModerationEvents('guild')).map((event) => String(event._id))).toEqual([
    second.id,
    first.id
  ]);
});
