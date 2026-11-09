const { AuditLogEvent, MessageFlags, PermissionFlagsBits } = require('discord.js');
const command = require('../../src/gsbot/commands/modCommand');
const { recordManualEvent } = require('../../src/core/services/moderationService');
const ModerationEvent = require('../../src/core/models/ModerationEvent');

const base = {
  guildId: 'guild',
  targetId: 'user',
  moderatorId: 'staff',
  type: 'note',
  reason: 'Contattato in privato; chiarite le regole.'
};
function interaction(subcommand) {
  return {
    guildId: 'guild',
    user: { id: 'staff' },
    options: {
      getSubcommand: () => subcommand,
      getUser: () => ({ id: 'user', username: 'Luca' }),
      getString: () => 'Motivo originale'
    },
    deferReply: jest.fn().mockResolvedValue(),
    editReply: jest.fn().mockResolvedValue(),
    reply: jest.fn().mockResolvedValue()
  };
}
afterEach(() => ModerationEvent.deleteMany({}));

test('registers all subcommands with one Discord-managed command permission', () => {
  const payload = command.data.toJSON();
  expect(payload.default_member_permissions).toBe(String(PermissionFlagsBits.ManageGuild));
  expect(payload.options.map((option) => option.name)).toEqual([
    'strike',
    'note',
    'view',
    'audit',
    'sync',
    'last'
  ]);
  expect(payload.options.find((option) => option.name === 'last').options || []).toEqual([]);
  expect(payload.options.every((option) => option.default_member_permissions === undefined)).toBe(
    true
  );
});

test.each(['strike', 'note'])(
  'persists /mod %s without an additional member permission gate',
  async (type) => {
    const request = interaction(type);
    await command.execute(request);
    expect(request.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(await ModerationEvent.findOne().lean()).toMatchObject({
      ...base,
      type,
      reason: 'Motivo originale',
      annotations: []
    });
    expect(request.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedMentions: { parse: [], users: [], roles: [], repliedUser: false }
      })
    );
  }
);

test('/mod view includes actual note text, author and totals', async () => {
  await recordManualEvent(base);
  const request = interaction('view');
  await command.execute(request);
  const description = request.editReply.mock.calls[0][0].embeds[0].description;
  expect(description).toContain(base.reason);
  expect(description).toContain('<@staff>');
  expect(description).toContain('Note generali: **1**');
  expect(description).toContain('Strike manuali: **0**');
});

test('/mod audit displays both actions, timeout expiry, missing metadata and stable audit ID', () => {
  const description = command.auditDescription({
    total: 1,
    recent: [
      {
        type: 'discord',
        actions: [
          { type: 'timeout', until: new Date('2026-11-10T12:00:00Z') },
          { type: 'voice_mute' }
        ],
        occurredAt: new Date('2026-11-09T12:00:00Z'),
        discordAuditId: '123456789012345678',
        moderatorId: null,
        reason: null
      }
    ]
  });
  expect(description).toContain('Timeout applicato + Mute vocale');
  expect(description).toContain('Timeout fino al:');
  expect(description).toContain('Moderatore: non disponibile');
  expect(description).toContain('Motivo: non disponibile');
  expect(description).toContain('123456789012345678');
});

test('bounded output remains within embed limits and neutralizes message formatting', () => {
  const event = {
    occurredAt: new Date(),
    moderatorId: '12345678901234567890',
    reason: '**@everyone**\n'.repeat(1000),
    actions: [{ type: 'timeout_removed' }, { type: 'voice_unmute' }],
    discordAuditId: '12345678901234567890'
  };
  const history = {
    counts: {
      strike: 300,
      note: 200,
      timeout: 200,
      timeout_removed: 200,
      voice_mute: 200,
      voice_unmute: 200,
      kick: 200,
      ban: 200,
      unban: 200
    },
    total: 2000,
    recent: Array(8).fill(event),
    notes: Array(3).fill(event)
  };
  expect(command.auditDescription(history).length).toBeLessThanOrEqual(4096);
  expect(command.viewDescription(history).length).toBeLessThanOrEqual(4096);
  expect(command.viewDescription(history)).not.toContain('@everyone');
});

test('/mod sync is available through the same permission system and responds privately', async () => {
  const request = interaction('sync');
  request.guild = {
    id: 'guild',
    fetchAuditLogs: jest.fn().mockResolvedValue({ entries: new Map() })
  };
  await command.execute(request);
  expect(request.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
  expect(request.editReply.mock.calls[0][0].content).toContain(
    'Esaminati: 0 · Inseriti: 0 · Saltati: 0 · Errori: 0'
  );
});

test('/mod last handles empty history privately without requiring a user argument', async () => {
  const request = interaction('last');
  request.options.getUser = jest.fn(() => {
    throw new Error('Unexpected user argument');
  });
  await command.execute(request);
  expect(request.options.getUser).not.toHaveBeenCalled();
  expect(request.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
  expect(request.editReply).toHaveBeenCalledWith(
    expect.objectContaining({
      allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
      embeds: [
        {
          title: 'Ultimi eventi di moderazione',
          description: 'Nessun evento di moderazione registrato.'
        }
      ]
    })
  );
});

test('/mod last includes synced records, target and moderator IDs, missing metadata and Rome time', async () => {
  const request = interaction('sync');
  const entry = {
    id: '1437440123456789012',
    targetId: '123456789012345678',
    executorId: '223456789012345678',
    action: AuditLogEvent.MemberBanAdd,
    createdTimestamp: Date.now() - 1000,
    reason: 'Synced reason'
  };
  request.guild = {
    id: 'guild',
    fetchAuditLogs: jest
      .fn()
      .mockResolvedValueOnce({ entries: new Map([['event', entry]]) })
      .mockResolvedValueOnce({ entries: new Map() })
  };
  await command.execute(request);
  await recordManualEvent(base);
  await ModerationEvent.create({
    ...base,
    moderatorId: null,
    reason: null,
    source: 'manual',
    occurredAt: new Date('2026-11-09T12:00:00Z'),
    actions: [{ type: 'note' }]
  });
  await recordManualEvent({ ...base, guildId: 'other', reason: 'Other guild secret' });
  const last = interaction('last');
  await command.execute(last);
  const payload = last.editReply.mock.calls[0][0];
  expect(payload.embeds).toHaveLength(1);
  expect(payload.embeds[0].title).toContain('1–3 di 3');
  const description = payload.embeds[0].description;
  expect(description).toContain('Synced reason');
  expect(description).toContain(`Audit ID: ${entry.id}`);
  expect(description).toContain(`Utente: <@${entry.targetId}> (ID: ${entry.targetId})`);
  expect(description).toContain(`Moderatore: <@${entry.executorId}> (ID: ${entry.executorId})`);
  expect(description).toContain(base.reason);
  expect(description).toContain('Moderatore: non disponibile');
  expect(description).toContain('Messaggio: non disponibile');
  expect(description).toContain('13:00');
  expect(description).not.toContain('Other guild secret');
});

test('/mod last displays ten long combined events within per-embed and total message limits', async () => {
  const reason = '**@everyone**\n'.repeat(1000);
  for (let index = 0; index < 11; index++) {
    await ModerationEvent.create({
      guildId: 'guild',
      targetId: '12345678901234567890',
      moderatorId: '22345678901234567890',
      type: 'discord',
      source: 'discord',
      reason,
      occurredAt: new Date(Date.UTC(2026, 6, 9, 12, index)),
      discordAuditId: `14374401234567890${String(index).padStart(2, '0')}`,
      actions: [
        { type: 'timeout', until: new Date('2026-07-10T12:00:00Z') },
        { type: 'voice_mute' }
      ]
    });
  }
  const request = interaction('last');
  await command.execute(request);
  const payload = request.editReply.mock.calls[0][0];
  expect(request.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
  expect(payload.allowedMentions.parse).toEqual([]);
  expect(payload.embeds).toHaveLength(2);
  const descriptions = payload.embeds.map((embed) => embed.description).join('\n');
  expect(descriptions.match(/Utente:/g)).toHaveLength(10);
  expect(descriptions).toContain('14:10');
  expect(descriptions).not.toContain('**09/07/26, 14:00 —');
  expect(descriptions).toContain('Timeout applicato + Mute vocale');
  expect(descriptions).toContain('\\*\\*');
  expect(descriptions).toContain('…');
  expect(descriptions).not.toContain('@everyone');
  expect(payload.embeds.every((embed) => embed.description.length <= 4096)).toBe(true);
  const totalLength = payload.embeds.reduce(
    (sum, embed) => sum + embed.title.length + embed.description.length + embed.footer.text.length,
    0
  );
  expect(totalLength).toBeLessThanOrEqual(6000);
});
