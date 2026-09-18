const { MessageFlags, SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
  .setName('test')
  .setDescription('Verifica temporanea dello stato di GSbot');

async function execute(interaction) {
  await interaction.reply({
    content: 'GSbot operativo.\nServer: Giocatori Stanchi',
    flags: MessageFlags.Ephemeral
  });
}

module.exports = { data, execute };
