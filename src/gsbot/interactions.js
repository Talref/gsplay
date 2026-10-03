const { MessageFlags } = require('discord.js');
const GsbotGuildConfig = require('../core/models/GsbotGuildConfig');

function ephemeral(content, extra = {}) {
  return {
    content,
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
    ...extra
  };
}

function memberHasRole(interaction, roleId) {
  const roles = interaction.member?.roles;
  if (!roles || !roleId) return false;
  if (Array.isArray(roles)) return roles.includes(roleId);
  return Boolean(roles.cache?.has(roleId));
}

async function isGsbotStaff(interaction) {
  const config = await GsbotGuildConfig.findOne({ guildId: interaction.guildId }).select(
    'roles.staff'
  );
  return memberHasRole(interaction, config?.roles?.staff);
}

module.exports = { ephemeral, isGsbotStaff, memberHasRole };
