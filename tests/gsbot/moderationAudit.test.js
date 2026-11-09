const { AuditLogEvent } = require('discord.js');
const {
  normalizeAuditEntry,
  ingestAuditEntry,
  syncModerationAudit
} = require('../../src/gsbot/features/moderationAudit');
const ModerationEvent = require('../../src/core/models/ModerationEvent');

const now = Date.parse('2026-11-09T12:00:00Z');
function entry(overrides = {}) {
  return {
    id: '1437440123456789012',
    targetId: 'target',
    executorId: 'moderator',
    action: AuditLogEvent.MemberKick,
    createdTimestamp: now,
    reason: null,
    ...overrides
  };
}
afterEach(() => ModerationEvent.deleteMany({}));

test.each([
  [AuditLogEvent.MemberKick, 'kick'],
  [AuditLogEvent.MemberBanAdd, 'ban'],
  [AuditLogEvent.MemberBanRemove, 'unban']
])('normalizes action %s with missing reason, executor and deleted target user', (action, type) => {
  expect(normalizeAuditEntry(entry({ action, executorId: null }), 'guild')).toMatchObject({
    guildId: 'guild',
    targetId: 'target',
    moderatorId: null,
    reason: null,
    actions: [{ type }],
    annotations: [],
    occurredAt: new Date(now)
  });
});

test('retains both timeout and mute changes in one event', () => {
  const event = normalizeAuditEntry(
    entry({
      action: AuditLogEvent.MemberUpdate,
      changes: [
        { key: 'communication_disabled_until', old: null, new: '2026-11-10T12:00:00Z' },
        { key: 'mute', old: false, new: true },
        { key: 'nick', new: 'Luca' }
      ]
    }),
    'guild'
  );
  expect(event.actions).toEqual([
    { type: 'timeout', previousUntil: null, until: new Date('2026-11-10T12:00:00Z') },
    { type: 'voice_mute' }
  ]);
});

test('classifies early timeout removal and voice unmute', () => {
  expect(
    normalizeAuditEntry(
      entry({
        action: AuditLogEvent.MemberUpdate,
        changes: [
          { key: 'communication_disabled_until', old: '2026-11-10T12:00:00Z', new: null },
          { key: 'mute', old: true, new: false }
        ]
      }),
      'guild'
    ).actions.map((action) => action.type)
  ).toEqual(['timeout_removed', 'voice_unmute']);
});

test('ignores expired timeouts, unchanged values, unsupported updates and missing targets', () => {
  expect(
    normalizeAuditEntry(
      entry({
        action: AuditLogEvent.MemberUpdate,
        changes: [
          { key: 'communication_disabled_until', old: '2026-11-08T12:00:00Z', new: null },
          { key: 'mute', old: true, new: true },
          { key: 'deaf', new: true }
        ]
      }),
      'guild'
    )
  ).toBeNull();
  expect(normalizeAuditEntry(entry({ targetId: null }), 'guild')).toBeNull();
});

test('live ingestion and repeated sync share idempotent persistence', async () => {
  await ModerationEvent.init();
  expect(await ingestAuditEntry(entry(), 'guild')).toBe('inserted');
  const guild = {
    id: 'guild',
    fetchAuditLogs: jest
      .fn()
      .mockResolvedValueOnce({ entries: new Map([['a', entry()]]) })
      .mockResolvedValueOnce({ entries: new Map() })
  };
  const result = await syncModerationAudit(guild, { now });
  expect(result).toEqual({ scanned: 1, inserted: 0, skipped: 1, failed: 0, incomplete: false });
  expect(await ModerationEvent.countDocuments()).toBe(1);
});

test('paginates to the 30-day boundary, counts failures and continues after write failures', async () => {
  const old = entry({ id: '100', createdTimestamp: now - 31 * 86400000 });
  const guild = {
    id: 'guild',
    fetchAuditLogs: jest
      .fn()
      .mockResolvedValueOnce({
        entries: new Map([
          ['a', entry()],
          ['b', entry({ id: '200' })]
        ])
      })
      .mockResolvedValueOnce({
        entries: new Map([
          ['old', old],
          ['c', entry({ id: '150' })]
        ])
      })
  };
  const ingest = jest
    .fn()
    .mockResolvedValueOnce('inserted')
    .mockRejectedValueOnce(new Error('DB unavailable'))
    .mockResolvedValueOnce('skipped');
  const result = await syncModerationAudit(guild, { now, ingest, log: { error: jest.fn() } });
  expect(guild.fetchAuditLogs.mock.calls).toEqual([
    [{ limit: 100 }],
    [{ limit: 100, before: '200' }]
  ]);
  expect(result).toEqual({ scanned: 3, inserted: 1, skipped: 1, failed: 1, incomplete: false });
});

test('reports partial results on Discord API failure', async () => {
  const guild = {
    id: 'guild',
    fetchAuditLogs: jest
      .fn()
      .mockResolvedValueOnce({ entries: new Map([['a', entry()]]) })
      .mockRejectedValueOnce(new Error('Missing Access'))
  };
  const result = await syncModerationAudit(guild, {
    now,
    ingest: jest.fn().mockResolvedValue('inserted'),
    log: { error: jest.fn() }
  });
  expect(result).toMatchObject({ scanned: 1, inserted: 1, failed: 1, incomplete: true });
});
