const {
  ApplicationCommandOptionType,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');
const GsbotGuildConfig = require('../../src/core/models/GsbotGuildConfig');
const gsbotAdminCommand = require('../../src/gsbot/commands/gsbotAdminCommand');

describe('/gsbot', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('defaults to Manage Server and requires a text or announcement channel', () => {
    const payload = gsbotAdminCommand.data.toJSON();
    expect(payload.name).toBe('gsbot');
    expect(payload.default_member_permissions).toBe(PermissionFlagsBits.ManageGuild.toString());
    expect(payload.options).toEqual([
      expect.objectContaining({
        name: 'birthday-channel',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          expect.objectContaining({
            name: 'channel',
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement]
          })
        ]
      })
    ]);
  });

  test('allows Discord-authorized staff without Manage Server and keeps channel changes guild-scoped', async () => {
    const guildId = '12345678901234567';
    const otherGuildId = '44567890123456789';
    const otherChannelId = '54567890123456789';
    await GsbotGuildConfig.create({
      guildId: otherGuildId,
      channels: { general: otherChannelId }
    });
    const command = {
      guildId,
      memberPermissions: { has: jest.fn().mockReturnValue(false) },
      options: {
        getSubcommand: () => 'birthday-channel',
        getChannel: jest.fn()
      },
      reply: jest.fn().mockResolvedValue(undefined)
    };

    // Cover both first configuration and replacement of this guild's channel.
    for (const channelId of ['34567890123456789', '64567890123456789']) {
      command.options.getChannel.mockReturnValue({ id: channelId });
      await gsbotAdminCommand.execute(command);

      expect(command.options.getChannel).toHaveBeenCalledWith('channel', true);
      expect(await GsbotGuildConfig.findOne({ guildId })).toMatchObject({
        channels: { general: channelId }
      });
      expect(await GsbotGuildConfig.findOne({ guildId: otherGuildId })).toMatchObject({
        channels: { general: otherChannelId }
      });
      expect(command.reply).toHaveBeenLastCalledWith({
        content: `Canale compleanni impostato: <#${channelId}>.`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [], users: [], repliedUser: false }
      });
    }
    expect(command.memberPermissions.has).not.toHaveBeenCalled();
    expect(await GsbotGuildConfig.countDocuments()).toBe(2);
  });
});
