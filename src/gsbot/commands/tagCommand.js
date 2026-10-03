const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const TemporaryTag = require('../../core/models/TemporaryTag');
const {
  COMMUNITY_TIME_ZONE,
  zonedDateTimeToUtc,
  zonedParts
} = require('../../core/time/communityTime');
const {
  activeTemporaryTag,
  countActiveTemporaryTagInvites,
  createTemporaryTag,
  deletableTemporaryTag,
  listActiveTemporaryTags,
  normalizeTagName,
  recordTemporaryTagInvite
} = require('../../core/services/temporaryTagService');
const { ephemeral, memberHasRole } = require('../interactions');

const CREATE_MODAL_ID = 'tag:create';
const TAG_ID_PREFIX = 'tag:';

const data = new SlashCommandBuilder()
  .setName('tag')
  .setDescription('Gestisce i tag temporanei della community')
  .setDefaultMemberPermissions(0)
  .addSubcommand((command) => command.setName('create').setDescription('Crea un tag temporaneo'))
  .addSubcommand((command) =>
    command
      .setName('invite')
      .setDescription('Pubblica il bottone di un tag')
      .addStringOption((option) =>
        option
          .setName('tag')
          .setDescription('Tag temporaneo')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((command) =>
    command
      .setName('info')
      .setDescription('Mostra i dettagli di un tag')
      .addStringOption((option) =>
        option
          .setName('tag')
          .setDescription('Tag temporaneo')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((command) => command.setName('list').setDescription('Elenca i tag attivi'))
  .addSubcommand((command) =>
    command
      .setName('delete')
      .setDescription('Elimina un tag temporaneo')
      .addStringOption((option) =>
        option
          .setName('tag')
          .setDescription('Tag temporaneo')
          .setRequired(true)
          .setAutocomplete(true)
      )
  );

function formatExpiration(date) {
  if (!date) return 'mai';
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: COMMUNITY_TIME_ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function parseExpiration(value) {
  const clean = value.trim();
  if (!clean) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(clean);
  if (!match) throw new Error('Scadenza non valida. Usa GG/MM/AAAA HH:mm.');
  const [, day, month, year, hour, minute] = match.map(Number);
  const date = zonedDateTimeToUtc({ day, month, year, hour, minute });
  const parts = zonedParts(date);
  if (
    parts.day !== day ||
    parts.month !== month ||
    parts.year !== year ||
    parts.hour !== hour ||
    parts.minute !== minute
  )
    throw new Error('Scadenza non valida. Usa una data reale in orario italiano.');
  return date;
}

function createModal() {
  return new ModalBuilder()
    .setCustomId(CREATE_MODAL_ID)
    .setTitle('Crea un tag temporaneo')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('Nome del tag')
          .setPlaceholder('Halloween')
          .setMaxLength(100)
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('button_label')
          .setLabel('Testo del bottone')
          .setPlaceholder('🎃 Partecipa a Halloween')
          .setMaxLength(80)
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('expires_at')
          .setLabel('Scadenza (facoltativa)')
          .setPlaceholder('GG/MM/AAAA HH:mm')
          .setRequired(false)
          .setStyle(TextInputStyle.Short)
      )
    );
}

function inviteComponents(tag, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tag:toggle:${tag.id}`)
        .setLabel(tag.buttonLabel)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled)
    )
  ];
}

function deleteComponents(tag, userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tag:delete:cancel:${tag.id}:${userId}`)
        .setLabel('Annulla')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`tag:delete:confirm:${tag.id}:${userId}`)
        .setLabel('Elimina')
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

function editEphemeral(content, extra = {}) {
  return {
    content,
    allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
    ...extra
  };
}

async function selectedTag(interaction) {
  const tagId = interaction.options.getString('tag', true);
  return activeTemporaryTag(interaction.guildId, tagId);
}

async function memberCount(interaction, tag) {
  const counts = await interaction.guild.roles.fetchMemberCounts();
  return counts.get(tag.discordRoleId) ?? 0;
}

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'create') {
    await interaction.showModal(createModal());
    return;
  }

  if (subcommand === 'list') {
    await interaction.deferReply({ flags: ephemeral('').flags });
    const tags = await listActiveTemporaryTags(interaction.guildId);
    if (!tags.length) {
      await interaction.editReply(editEphemeral('Nessun tag temporaneo attivo.'));
      return;
    }
    const counts = await interaction.guild.roles.fetchMemberCounts();
    const lines = tags.map(
      (tag) =>
        `• <@&${tag.discordRoleId}> — ${counts.get(tag.discordRoleId) ?? 0} membri — scadenza: ${formatExpiration(tag.expiresAt)}`
    );
    const visible = [];
    for (const line of lines) {
      if (`Tag temporanei attivi:\n${visible.concat(line).join('\n')}`.length > 1_900) break;
      visible.push(line);
    }
    const omitted = lines.length - visible.length;
    await interaction.editReply(
      editEphemeral(
        `Tag temporanei attivi:\n${visible.join('\n')}${omitted ? `\n… e altri ${omitted}.` : ''}`
      )
    );
    return;
  }

  const tag = await selectedTag(interaction);
  if (!tag) {
    await interaction.reply(ephemeral('Tag temporaneo non trovato o non più attivo.'));
    return;
  }

  if (subcommand === 'invite') {
    await interaction.deferReply({ flags: ephemeral('').flags });
    const message = await interaction.channel.send({ components: inviteComponents(tag) });
    try {
      await recordTemporaryTagInvite({
        tagId: tag.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        messageId: message.id,
        createdBy: interaction.user.id
      });
    } catch (error) {
      await message.delete().catch(() => undefined);
      if (error.code === 'temporary_tag_not_active') {
        await interaction.editReply(editEphemeral(error.message));
        return;
      }
      throw error;
    }
    await interaction.editReply(editEphemeral(`Invito per <@&${tag.discordRoleId}> pubblicato.`));
    return;
  }

  await interaction.deferReply({ flags: ephemeral('').flags });
  const [members, invites] = await Promise.all([
    memberCount(interaction, tag),
    countActiveTemporaryTagInvites(tag.id)
  ]);
  if (subcommand === 'info') {
    await interaction.editReply(
      editEphemeral(
        `<@&${tag.discordRoleId}>\n\nMembri: ${members}\nScadenza: ${formatExpiration(tag.expiresAt)}\nInviti attivi: ${invites}\nCreato da: <@${tag.createdBy}>\nCreato il: ${formatExpiration(tag.createdAt)}`
      )
    );
    return;
  }

  await interaction.editReply(
    editEphemeral(
      `Eliminare <@&${tag.discordRoleId}>?\n\nMembri: ${members}\nInviti attivi: ${invites}\nScadenza: ${formatExpiration(tag.expiresAt)}`,
      { components: deleteComponents(tag, interaction.user.id) }
    )
  );
}

async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLocaleLowerCase('it-IT');
  const tags = await listActiveTemporaryTags(interaction.guildId);
  await interaction.respond(
    tags
      .filter((tag) => tag.name.toLocaleLowerCase('it-IT').includes(focused))
      .slice(0, 25)
      .map((tag) => ({ name: tag.name, value: tag.id }))
  );
}

async function handleCreateModal(interaction) {
  const name = interaction.fields.getTextInputValue('name');
  const buttonLabel = interaction.fields.getTextInputValue('button_label');
  let expiresAt;
  try {
    expiresAt = parseExpiration(interaction.fields.getTextInputValue('expires_at'));
    if (
      await TemporaryTag.exists({
        guildId: interaction.guildId,
        normalizedName: normalizeTagName(name),
        status: { $ne: 'deleted' }
      })
    )
      throw new Error('Esiste già un tag attivo con questo nome.');
  } catch (error) {
    await interaction.reply(ephemeral(error.message));
    return;
  }

  await interaction.deferReply({ flags: ephemeral('').flags });
  let role;
  try {
    role = await interaction.guild.roles.create({
      name: name.trim().replace(/\s+/g, ' '),
      permissions: [],
      hoist: false,
      mentionable: false,
      reason: `GSbot temporary tag created by ${interaction.user.id}`
    });
    const tag = await createTemporaryTag({
      guildId: interaction.guildId,
      discordRoleId: role.id,
      name,
      buttonLabel,
      expiresAt,
      createdBy: interaction.user.id
    });
    await interaction.editReply({
      content: `<@&${tag.discordRoleId}> creato\n\nMembri: 0\nScadenza: ${formatExpiration(tag.expiresAt)}`,
      allowedMentions: { parse: [], roles: [], users: [], repliedUser: false }
    });
  } catch (error) {
    if (role) await role.delete('Rollback creazione tag GSbot non riuscita').catch(() => undefined);
    await interaction.editReply({ content: error.message || 'Creazione del tag non riuscita.' });
  }
}

async function handleToggle(interaction, tagId) {
  const tag = await activeTemporaryTag(interaction.guildId, tagId);
  if (!tag) {
    await interaction.reply(ephemeral('Questo tag non è più attivo.'));
    return;
  }
  const hasRole = memberHasRole(interaction, tag.discordRoleId);
  const method = hasRole ? 'removeRole' : 'addRole';
  await interaction.guild.members[method]({
    user: interaction.user.id,
    role: tag.discordRoleId,
    reason: `GSbot temporary tag ${hasRole ? 'removed' : 'assigned'}: ${tag.name}`
  });
  await interaction.reply(
    ephemeral(
      hasRole
        ? `Hai rimosso il tag <@&${tag.discordRoleId}>.`
        : `Hai ricevuto il tag <@&${tag.discordRoleId}> - Clicca di nuovo sul bottone per rimuoverti`
    )
  );
}

async function handleDeleteButton(interaction, action, tagId, userId, context) {
  if (interaction.user.id !== userId) {
    await interaction.reply(ephemeral('Questa conferma appartiene a un altro utente.'));
    return;
  }
  if (action === 'cancel') {
    await interaction.update({ content: 'Eliminazione annullata.', components: [] });
    return;
  }
  const tag = await deletableTemporaryTag(interaction.guildId, tagId);
  if (!tag) {
    await interaction.update({ content: 'Il tag non è più attivo.', components: [] });
    return;
  }
  await interaction.deferUpdate();
  try {
    await context.temporaryTagCleanup.cleanup(tag, { deletedBy: interaction.user.id });
    await interaction.editReply({ content: `<@&${tag.discordRoleId}> eliminato.`, components: [] });
  } catch {
    await interaction.editReply({
      content: 'Eliminazione non completata. Riprova: le operazioni già riuscite sono al sicuro.',
      components: deleteComponents(tag, interaction.user.id)
    });
  }
}

function handles(interaction) {
  return interaction.customId?.startsWith(TAG_ID_PREFIX);
}

async function handleInteraction(interaction, context) {
  if (interaction.isModalSubmit?.() && interaction.customId === CREATE_MODAL_ID) {
    await handleCreateModal(interaction);
    return;
  }
  if (!interaction.isButton?.()) return;
  const [scope, operation, actionOrId, tagId, userId] = interaction.customId.split(':');
  if (scope !== 'tag') return;
  if (operation === 'toggle') await handleToggle(interaction, actionOrId);
  else if (operation === 'delete')
    await handleDeleteButton(interaction, actionOrId, tagId, userId, context);
}

module.exports = {
  autocomplete,
  createModal,
  data,
  execute,
  formatExpiration,
  handleInteraction,
  handles,
  inviteComponents,
  parseExpiration
};
