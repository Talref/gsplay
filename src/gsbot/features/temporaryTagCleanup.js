const { ActionRowBuilder, ButtonBuilder, ButtonStyle, RESTJSONErrorCodes } = require('discord.js');
const TemporaryTag = require('../../core/models/TemporaryTag');
const {
  activeTemporaryTagInvites,
  archiveTemporaryTag,
  beginTemporaryTagDeletion,
  markTemporaryTagInviteDisabled
} = require('../../core/services/temporaryTagService');

function disabledInviteComponents(tag) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tag:toggle:${tag.id}`)
        .setLabel(tag.buttonLabel)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    )
  ];
}

function isMissingDiscordResource(error) {
  return [
    RESTJSONErrorCodes.UnknownChannel,
    RESTJSONErrorCodes.UnknownMessage,
    RESTJSONErrorCodes.UnknownRole
  ].includes(error?.code);
}

function createTemporaryTagCleanup({ client, log = console }) {
  async function disableInvite(tag, invite) {
    try {
      const channel = await client.channels.fetch(invite.channelId);
      if (!channel?.isTextBased() || !channel.messages?.edit) {
        await markTemporaryTagInviteDisabled(invite.id);
        return;
      }
      await channel.messages.edit(invite.messageId, {
        components: disabledInviteComponents(tag)
      });
      await markTemporaryTagInviteDisabled(invite.id);
    } catch (error) {
      if (!isMissingDiscordResource(error)) throw error;
      await markTemporaryTagInviteDisabled(invite.id);
    }
  }

  async function cleanup(tagOrId, { deletedBy = null, guildId = null } = {}) {
    const tagId = typeof tagOrId === 'string' ? tagOrId : tagOrId._id;
    const tag = await TemporaryTag.findOne({ _id: tagId, ...(guildId ? { guildId } : {}) });
    if (!tag || tag.status === 'deleted') return tag;
    if (tag.status === 'active') {
      const claimed = await beginTemporaryTagDeletion(tag.id);
      if (claimed) tag.status = claimed.status;
    }

    const guild = await client.guilds.fetch(tag.guildId);
    const role = await guild.roles.fetch(tag.discordRoleId);
    if (role) {
      try {
        await role.delete(`GSbot temporary tag cleanup: ${tag.name}`);
      } catch (error) {
        if (!isMissingDiscordResource(error)) throw error;
      }
    }

    const invites = await activeTemporaryTagInvites(tag.id);
    for (const invite of invites) await disableInvite(tag, invite);

    const archived = await archiveTemporaryTag(tag.id, deletedBy);
    log.info(
      `GSbot temporary tag deleted · tag=${tag.id} · guild=${tag.guildId} · invites=${invites.length}`
    );
    return archived || TemporaryTag.findById(tag.id);
  }

  return { cleanup, disableInvite };
}

module.exports = { createTemporaryTagCleanup, disabledInviteComponents };
