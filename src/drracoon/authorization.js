const { ChannelType, PermissionFlagsBits: P } = require('discord.js');

async function resolveAccess(source, { config, client }) {
  if (!config.guildIds.includes(source.guildId)) throw new Error('guild_not_allowed');
  const guild = await client.guilds.fetch(source.guildId);
  const channel = await guild.channels.fetch(source.channelId);
  if (
    !channel ||
    channel.guildId !== guild.id ||
    ![
      ChannelType.GuildText,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
      ChannelType.AnnouncementThread
    ].includes(channel.type)
  )
    throw new Error('channel_not_allowed');
  const [member, bot] = await Promise.all([
    guild.members.fetch({ user: source.authorId, force: true }),
    guild.members.fetchMe({ force: true })
  ]);
  if (member.guild.id !== guild.id) throw new Error('member_not_allowed');
  const permissions = channel.permissionsFor(bot);
  const send = channel.isThread() ? P.SendMessagesInThreads : P.SendMessages;
  if (
    !permissions?.has([P.ViewChannel, P.ReadMessageHistory, send]) ||
    !channel.permissionsFor(member)?.has([P.ViewChannel, P.ReadMessageHistory]) ||
    (channel.isThread() && (channel.archived || channel.locked))
  )
    throw new Error('channel_access_denied');
  const staffDestination =
    config.staffChannelIds.includes(channel.id) ||
    (channel.isThread() && config.staffChannelIds.includes(channel.parentId));
  if (channel.type === ChannelType.PrivateThread) {
    // Parent permissions alone do not establish membership of a private thread.
    await channel.members.fetch(source.authorId).catch(() => {
      throw new Error('channel_access_denied');
    });
  }
  const staff = staffDestination && config.staffRoleIds.some((id) => member.roles.cache.has(id));
  return { channel, scope: staff ? 'staff' : 'user' };
}

async function revalidate(job, dependencies) {
  const access = await resolveAccess(job, dependencies);
  if (access.scope !== job.scope) throw new Error('authorization_changed');
  return access;
}

module.exports = { resolveAccess, revalidate };
