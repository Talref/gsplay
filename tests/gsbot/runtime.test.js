const { EventEmitter } = require('node:events');
const { Events, MessageFlags } = require('discord.js');
const testCommand = require('../../src/gsbot/commands/testCommand');
const birthdayCommand = require('../../src/gsbot/commands/birthdayCommand');
const tagCommand = require('../../src/gsbot/commands/tagCommand');
const {
  commandPayload,
  createGsbotClient,
  createGsbotRuntime
} = require('../../src/gsbot/runtime');

const config = {
  token: 'discord-token',
  guildIds: ['123456789012345678', '223456789012345678']
};

function fakeDiscord() {
  const client = new EventEmitter();
  const guilds = config.guildIds.map((id, index) => ({
    id,
    name: index === 0 ? 'Giocatori Stanchi' : 'Giocatori Riposati',
    commands: { set: jest.fn().mockResolvedValue(undefined) }
  }));
  client.guilds = {
    fetch: jest.fn(async (guildId) => guilds.find((guild) => guild.id === guildId))
  };
  client.destroy = jest.fn();
  client.login = jest.fn(async () => {
    queueMicrotask(() => client.emit(Events.ClientReady, client));
    return config.token;
  });
  return { client, guilds };
}

describe('GSbot runtime', () => {
  test('requests only the Guilds Gateway intent', () => {
    const client = createGsbotClient();
    expect(client.options.intents.toArray()).toEqual(['Guilds']);
    client.destroy();
  });

  test('registers the guild-scoped commands in every configured guild', async () => {
    const { client, guilds } = fakeDiscord();
    const runtime = createGsbotRuntime({
      config,
      client,
      log: { info: jest.fn(), error: jest.fn() }
    });

    await runtime.start();

    expect(client.guilds.fetch.mock.calls.map(([guildId]) => guildId)).toEqual(config.guildIds);
    for (const guild of guilds) {
      expect(guild.commands.set).toHaveBeenCalledWith(
        commandPayload([testCommand, birthdayCommand, tagCommand])
      );
    }
    expect(commandPayload([testCommand])).toEqual([
      expect.objectContaining({
        name: 'test',
        description: expect.stringContaining('GSbot')
      })
    ]);
  });

  test('accepts configured guild interactions and ignores unconfigured guilds', async () => {
    const { client } = fakeDiscord();
    const log = { info: jest.fn(), error: jest.fn() };
    const runtime = createGsbotRuntime({ config, client, log });
    await runtime.start();
    const interaction = {
      commandName: 'test',
      guildId: config.guildIds[1],
      user: { id: '987654321098765432' },
      isChatInputCommand: () => true,
      reply: jest.fn().mockResolvedValue(undefined)
    };

    client.emit(Events.InteractionCreate, interaction);
    await new Promise((resolve) => setImmediate(resolve));

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'GSbot operativo.\nServer: Giocatori Stanchi',
      flags: MessageFlags.Ephemeral
    });
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('GSbot interaction complete'));
    const ignoredInteraction = {
      ...interaction,
      guildId: '323456789012345678',
      reply: jest.fn().mockResolvedValue(undefined)
    };
    client.emit(Events.InteractionCreate, ignoredInteraction);
    await new Promise((resolve) => setImmediate(resolve));
    expect(ignoredInteraction.reply).not.toHaveBeenCalled();
    await runtime.stop();
    expect(client.destroy).toHaveBeenCalledTimes(1);
  });

  test('destroys the client when command registration fails', async () => {
    const { client, guilds } = fakeDiscord();
    guilds[1].commands.set.mockRejectedValue(new Error('Discord unavailable'));
    const runtime = createGsbotRuntime({
      config,
      client,
      log: { info: jest.fn(), error: jest.fn() }
    });

    await expect(runtime.start()).rejects.toThrow('GSbot startup failed: Discord unavailable');
    expect(client.destroy).toHaveBeenCalledTimes(1);
  });

  test('does not become ready when the deployment readiness signal fails', async () => {
    const { client } = fakeDiscord();
    const onReady = jest.fn().mockRejectedValue(new Error('readiness marker unavailable'));
    const runtime = createGsbotRuntime({
      config,
      client,
      onReady,
      log: { info: jest.fn(), error: jest.fn() }
    });

    await expect(runtime.start()).rejects.toThrow(
      'GSbot startup failed: readiness marker unavailable'
    );
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(client.destroy).toHaveBeenCalledTimes(1);
  });
});
