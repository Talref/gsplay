const { MessageFlags, PermissionFlagsBits } = require('discord.js');
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
    'sync'
  ]);
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
