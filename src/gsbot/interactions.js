const { MessageFlags } = require('discord.js');

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

module.exports = { ephemeral, memberHasRole };
