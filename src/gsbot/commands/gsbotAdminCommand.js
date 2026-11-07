const {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} = require('discord.js');
const GsbotGuildConfig = require('../../core/models/GsbotGuildConfig');

const data = new SlashCommandBuilder()
  .setName('gsbot')
  .setDescription('Configurazione di GSbot')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((command) =>
    command
      .setName('birthday-channel')
      .setDescription('Imposta il canale per gli avvisi di compleanno')
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('Canale per gli avvisi di compleanno')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true)
      )
  );

async function execute(interaction) {
  if (interaction.options.getSubcommand() === 'birthday-channel') {
    const channel = interaction.options.getChannel('channel', true);
    await GsbotGuildConfig.findOneAndUpdate(
      { guildId: interaction.guildId },
      { $set: { 'channels.general': channel.id } },
      { upsert: true, setDefaultsOnInsert: true }
    );
    await interaction.reply({
      content: `Canale compleanni impostato: <#${channel.id}>.`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [], users: [], repliedUser: false }
    });
  }
}

module.exports = { data, execute };
