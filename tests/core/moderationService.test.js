const ModerationEvent = require('../../src/core/models/ModerationEvent');
const {
  recordManualEvent,
  recordDiscordEvent,
  moderationHistory
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
