const {
  escapeMarkdown,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} = require('discord.js');
const { moderationHistory, recordManualEvent } = require('../../core/services/moderationService');
const { syncModerationAudit } = require('../features/moderationAudit');
const { ephemeral } = require('../interactions');

const data = new SlashCommandBuilder()
  .setName('mod')
  .setDescription('Registro di moderazione')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
for (const [name, description, field] of [
  ['strike', 'Registra un intervento disciplinare', 'reason'],
  ['note', 'Aggiunge una nota generale', 'message'],
  ['view', 'Mostra il riepilogo e le note', null],
  ['audit', 'Mostra gli eventi di moderazione recenti', null]
]) {
  data.addSubcommand((command) => {
    command
      .setName(name)
      .setDescription(description)
      .addUserOption((option) => option.setName('user').setDescription('Utente').setRequired(true));
    if (field)
      command.addStringOption((option) =>
        option
          .setName(field)
          .setDescription(field === 'reason' ? 'Motivo originale' : 'Testo della nota')
          .setMinLength(1)
          .setMaxLength(1000)
          .setRequired(true)
      );
    return command;
  });
}
data.addSubcommand((command) =>
  command.setName('sync').setDescription('Recupera gli eventi Discord degli ultimi 30 giorni')
);

const labels = {
  strike: 'Strike',
  note: 'Nota',
  kick: 'Espulsione',
  ban: 'Ban',
  unban: 'Revoca ban',
  timeout: 'Timeout applicato',
  timeout_removed: 'Timeout rimosso',
  voice_mute: 'Mute vocale',
  voice_unmute: 'Mute vocale rimosso'
};
const dateFormat = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome',
  dateStyle: 'short',
  timeStyle: 'short'
});
function text(value, max = 240) {
  const escaped = escapeMarkdown(String(value))
    .replace(/@/g, '@\u200b')
    .replace(/[\r\n]+/g, ' ');
  return escaped.length > max ? `${escaped.slice(0, max - 1)}…` : escaped;
}
function eventLabel(event) {
  return event.actions.map((action) => labels[action.type]).join(' + ');
}
function header(event) {
  return `**${dateFormat.format(event.occurredAt)} — ${eventLabel(event)}**\nModeratore: ${event.moderatorId ? `<@${event.moderatorId}>` : 'non disponibile'}`;
}
function auditDescription({ recent, total }) {
  if (!total) return 'Nessun evento di moderazione registrato.';
  return (
    `Ultimi ${recent.length} eventi su ${total}, dal più recente. Orari Europe/Rome. I testi lunghi sono abbreviati.\n\n` +
    recent
      .map((event) => {
        const details = event.actions
          .filter((action) => action.until)
          .map((action) => `Timeout fino al: ${dateFormat.format(action.until)}`);
        return [
          header(event),
          ...details,
          `${event.type === 'note' ? 'Messaggio' : 'Motivo'}: ${event.reason ? text(event.reason) : 'non disponibile'}`,
          event.discordAuditId
            ? `Fonte: Discord · Audit ID: ${event.discordAuditId}`
            : 'Fonte: manuale'
        ].join('\n');
      })
      .join('\n\n')
  );
}
function viewDescription({ counts, recent, notes, total }) {
  if (!total) return 'Nessun evento di moderazione registrato.';
  const actions = Object.entries(counts).filter(([type]) => !['strike', 'note'].includes(type));
  return [
    `Strike manuali: **${counts.strike || 0}** · Note generali: **${counts.note || 0}**`,
    `Azioni Discord: ${actions.length ? actions.map(([type, count]) => `${labels[type]}: **${count}**`).join(' · ') : 'nessuna'}`,
    `**Note generali — ultime ${notes.length} su ${counts.note || 0}**`,
    ...notes.map((event) => `${header(event)}\n${text(event.reason, 350)}`),
    '**Attività recente**',
    ...recent
      .slice(0, 3)
      .map((event) => `${dateFormat.format(event.occurredAt)} — ${eventLabel(event)}`),
    'Orari Europe/Rome. I testi lunghi sono abbreviati. Usa /mod audit per i dettagli degli eventi recenti.'
  ].join('\n');
}

function privateContent(content) {
  return { content, allowedMentions: { parse: [], users: [], roles: [], repliedUser: false } };
}

const syncingGuilds = new Set();
async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'sync') {
    if (syncingGuilds.has(interaction.guildId)) {
      await interaction.reply(ephemeral('Sincronizzazione già in corso per questo server.'));
      return;
    }
    syncingGuilds.add(interaction.guildId);
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await syncModerationAudit(interaction.guild);
      await interaction.editReply(
        privateContent(
          `Sincronizzazione ${result.incomplete ? 'incompleta' : 'terminata'} (ultimi 30 giorni).\n` +
            `Esaminati: ${result.scanned} · Inseriti: ${result.inserted} · Saltati: ${result.skipped} · Errori: ${result.failed}`
        )
      );
    } finally {
      syncingGuilds.delete(interaction.guildId);
    }
    return;
  }
  const user = interaction.options.getUser('user', true);
  if (subcommand === 'strike' || subcommand === 'note') {
    const reason = interaction.options.getString(
      subcommand === 'strike' ? 'reason' : 'message',
      true
    );
    if (!reason.trim()) {
      await interaction.reply(ephemeral('Il motivo o messaggio non può essere vuoto.'));
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await recordManualEvent({
      guildId: interaction.guildId,
      targetId: user.id,
      moderatorId: interaction.user.id,
      type: subcommand,
      reason
    });
    await interaction.editReply(
      privateContent(
        `${subcommand === 'strike' ? 'Strike registrato' : 'Nota aggiunta'} per <@${user.id}>.`
      )
    );
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const history = await moderationHistory(interaction.guildId, user.id);
  await interaction.editReply({
    ...privateContent(undefined),
    embeds: [
      {
        title: `${subcommand === 'view' ? 'Moderazione' : 'Storico moderazione'} — ${text(user.username || user.id, 100)}`,
        description: subcommand === 'view' ? viewDescription(history) : auditDescription(history),
        footer: { text: `Discord user ID: ${user.id}` }
      }
    ]
  });
}

module.exports = { data, execute, auditDescription, viewDescription };
