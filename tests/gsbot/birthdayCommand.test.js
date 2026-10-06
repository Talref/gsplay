const { ChannelType, MessageFlags, PermissionFlagsBits } = require('discord.js');
const Birthday = require('../../src/core/models/Birthday');
const GsbotGuildConfig = require('../../src/core/models/GsbotGuildConfig');
const birthdayCommand = require('../../src/gsbot/commands/birthdayCommand');

function interaction(subcommand, overrides = {}) {
  const values = { day: 4, month: 7, year: null, channel: null };
  return {
    guildId: '12345678901234567',
    user: { id: '23456789012345678' },
    options: {
      getSubcommand: () => subcommand,
      getInteger: (name) => values[name],
      getUser: () => null,
      getChannel: (name) => values[name]
    },
    reply: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe('/birthday', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('registers the expected subcommands and arguments', () => {
    const payload = birthdayCommand.data.toJSON();
    expect(payload.name).toBe('birthday');
    expect(payload.default_member_permissions).toBe(PermissionFlagsBits.ManageGuild.toString());
    expect(payload.options.map(({ name }) => name)).toEqual([
      'set',
      'remove',
      'show',
      'test',
      'channelset'
    ]);
    expect(payload.options[0].options.map(({ name, required }) => ({ name, required }))).toEqual([
      { name: 'day', required: true },
      { name: 'month', required: true },
      { name: 'year', required: false }
    ]);
    expect(payload.options[4].options).toEqual([
      expect.objectContaining({
        name: 'channel',
        required: true,
        channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement]
      })
    ]);
  });

  test('sets the birthday channel for the interaction guild and confirms privately', async () => {
    const selectedChannel = { id: '34567890123456789' };
    const command = interaction('channelset');
    command.options.getChannel = jest.fn().mockReturnValue(selectedChannel);

    await birthdayCommand.execute(command);

    expect(command.options.getChannel).toHaveBeenCalledWith('channel', true);
    expect(await GsbotGuildConfig.findOne({ guildId: command.guildId })).toMatchObject({
      channels: { general: selectedChannel.id }
    });
    expect(command.reply).toHaveBeenCalledWith({
      content: `Canale compleanni impostato: <#${selectedChannel.id}>.`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [], users: [], repliedUser: false }
    });
  });

  test('sets, shows, and removes only the invoking user birthday', async () => {
    const set = interaction('set');
    await birthdayCommand.execute(set);
    expect(await Birthday.findOne({ discordUserId: set.user.id })).toMatchObject({
      day: 4,
      month: 7
    });
    expect(set.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Compleanno impostato: 04/07.',
        flags: MessageFlags.Ephemeral
      })
    );

    const show = interaction('show');
    await birthdayCommand.execute(show);
    expect(show.reply.mock.calls[0][0].content).toContain('04/07');

    const remove = interaction('remove');
    await birthdayCommand.execute(remove);
    expect(await Birthday.findOne({ discordUserId: set.user.id })).toBeNull();
  });

  test('test is private, uses the shared renderer, and does not schedule work', async () => {
    const missing = interaction('test');
    await birthdayCommand.execute(missing);
    expect(missing.reply).toHaveBeenCalledWith({
      content: 'Non hai ancora impostato il tuo compleanno. Usa /birthday set.',
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [], users: [], repliedUser: false }
    });

    await Birthday.create({
      guildId: missing.guildId,
      discordUserId: missing.user.id,
      day: 4,
      month: 7
    });
    const configured = interaction('test');
    await birthdayCommand.execute(configured);
    expect(configured.reply.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        content: expect.stringContaining(`Oggi <@${configured.user.id}>`),
        flags: MessageFlags.Ephemeral
      })
    );
    expect(await require('../../src/core/models/ScheduledJob').countDocuments()).toBe(0);
  });
});
