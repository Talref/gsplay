const { EventEmitter } = require('node:events');
const { ChannelType } = require('discord.js');

function fakeDiscord() {
  const records = new Map(),
    roles = new Map(),
    denied = new Set();
  const client = new EventEmitter();
  client.user = { id: 'bot' };
  const guild = { id: 'guild' };
  const channel = {
    id: 'channel',
    guildId: guild.id,
    type: ChannelType.GuildText,
    isThread: () => false,
    permissionsFor: (member) => ({ has: () => !denied.has(member.id) })
  };
  const member = (id) => ({
    id,
    guild,
    roles: { cache: new Map((roles.get(id) || []).map((role) => [role, {}])) }
  });
  channel.members = { fetch: jest.fn(async (id) => ({ id })) };
  guild.channels = { fetch: jest.fn(async (id) => (id === channel.id ? channel : null)) };
  guild.members = {
    fetch: jest.fn(async ({ user }) => member(user)),
    fetchMe: jest.fn(async () => member('bot'))
  };
  client.guilds = {
    fetch: jest.fn(async (id) => {
      if (id !== guild.id) throw new Error('unknown guild');
      return guild;
    })
  };
  client.isReady = () => true;
  client.login = jest.fn(async () => {
    setImmediate(() => client.emit('clientReady', client));
  });
  client.destroy = jest.fn();
  channel.messages = {
    fetch: jest.fn(async (id) => {
      if (typeof id === 'object') return records;
      if (!records.has(id)) throw Object.assign(new Error('deleted'), { code: 10008 });
      return records.get(id);
    })
  };
  channel.send = jest.fn(async (payload) => {
    const old = payload.nonce && [...records.values()].find((m) => m.nonce === payload.nonce);
    if (old) return old;
    const message = {
      id: `bot-${records.size}`,
      author: { id: 'bot', bot: true },
      content: payload.content,
      nonce: payload.nonce,
      reference: { messageId: payload.reply?.messageReference },
      createdTimestamp: Date.now()
    };
    message.edit = jest.fn(async ({ content }) => {
      message.content = content;
      return message;
    });
    records.set(message.id, message);
    return message;
  });
  function source(id, extra = {}) {
    const message = {
      id,
      guildId: guild.id,
      channelId: channel.id,
      channel,
      author: { id: 'alice', bot: false },
      content: '<@bot> domanda',
      mentions: { users: new Map([['bot', {}]]) },
      ...extra
    };
    message.reply = jest.fn(async (payload) =>
      channel.send({ ...payload, reply: { messageReference: id } })
    );
    records.set(id, message);
    return message;
  }
  return { client, guild, channel, source, records, roles, denied };
}

module.exports = { fakeDiscord };
