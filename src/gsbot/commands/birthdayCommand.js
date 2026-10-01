const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const Birthday = require('../../core/models/Birthday');
const {
  removeBirthday,
  renderBirthdayMessage,
  setBirthday
} = require('../../core/services/birthdayService');

const VALIDATION_MESSAGES = new Set([
  'Giorno e mese non validi.',
  'Anno non valido.',
  'Data di compleanno non valida.'
]);

const data = new SlashCommandBuilder()
  .setName('birthday')
  .setDescription('Gestisce i compleanni della community')
  .addSubcommand((command) =>
    command
      .setName('set')
      .setDescription('Imposta il tuo compleanno')
      .addIntegerOption((option) =>
        option
          .setName('day')
          .setDescription('Giorno')
          .setMinValue(1)
          .setMaxValue(31)
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('month')
          .setDescription('Mese')
          .setMinValue(1)
          .setMaxValue(12)
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option.setName('year').setDescription('Anno (facoltativo)').setMinValue(1).setMaxValue(9999)
      )
  )
  .addSubcommand((command) => command.setName('remove').setDescription('Rimuove il tuo compleanno'))
  .addSubcommand((command) =>
    command
      .setName('show')
      .setDescription('Mostra un compleanno configurato')
      .addUserOption((option) =>
        option.setName('user').setDescription('Utente; se omesso mostra il tuo compleanno')
      )
  )
  .addSubcommand((command) =>
    command.setName('test').setDescription('Mostra in privato un messaggio di prova')
  );

function ephemeral(content) {
  return {
    content,
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [], users: [], repliedUser: false }
  };
}

function birthdayDate(birthday) {
  const date = `${String(birthday.day).padStart(2, '0')}/${String(birthday.month).padStart(2, '0')}`;
  return birthday.year ? `${date}/${birthday.year}` : date;
}

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const identity = { guildId: interaction.guildId, discordUserId: interaction.user.id };

  if (subcommand === 'set') {
    try {
      const day = interaction.options.getInteger('day', true);
      const month = interaction.options.getInteger('month', true);
      const year = interaction.options.getInteger('year');
      await setBirthday({ ...identity, day, month, year });
      await interaction.reply(
        ephemeral(`Compleanno impostato: ${birthdayDate({ day, month, year })}.`)
      );
    } catch (error) {
      await interaction.reply(
        ephemeral(
          VALIDATION_MESSAGES.has(error.message)
            ? error.message
            : 'Non è stato possibile salvare il compleanno. Riprova.'
        )
      );
    }
    return;
  }

  if (subcommand === 'remove') {
    const removed = await removeBirthday(identity);
    await interaction.reply(
      ephemeral(removed ? 'Compleanno rimosso.' : 'Non hai ancora impostato il tuo compleanno.')
    );
    return;
  }

  if (subcommand === 'show') {
    const user = interaction.options.getUser('user') || interaction.user;
    const birthday = await Birthday.findOne({
      guildId: interaction.guildId,
      discordUserId: user.id
    });
    await interaction.reply(
      ephemeral(
        birthday
          ? `Compleanno di <@${user.id}>: ${birthdayDate(birthday)}.`
          : `<@${user.id}> non ha ancora impostato il compleanno.`
      )
    );
    return;
  }

  const birthday = await Birthday.findOne(identity);
  await interaction.reply(
    ephemeral(
      birthday
        ? renderBirthdayMessage(interaction.user.id)
        : 'Non hai ancora impostato il tuo compleanno. Usa /birthday set.'
    )
  );
}

module.exports = { birthdayDate, data, execute };
