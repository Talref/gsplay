const { EventEmitter } = require('node:events');
const { Events, MessageFlags } = require('discord.js');
const testCommand = require('../../src/gsbot/commands/testCommand');
const {
  commandPayload,
  createGsbotClient,
  createGsbotRuntime
} = require('../../src/gsbot/runtime');

const config = { token: 'discord-token', guildId: '123456789012345678' };

function fakeDiscord() {
  const client = new EventEmitter();
  const guild = {
    id: config.guildId,
    name: 'Giocatori Stanchi',
    commands: { set: jest.fn().mockResolvedValue(undefined) }
  };
  client.guilds = { fetch: jest.fn().mockResolvedValue(guild) };
  client.destroy = jest.fn();
  client.login = jest.fn(async () => {
    queueMicrotask(() => client.emit(Events.ClientReady, client));
    return config.token;
  });
  return { client, guild };
}

describe('GSbot runtime', () => {
  test('requests only the Guilds Gateway intent', () => {
    const client = createGsbotClient();
    expect(client.options.intents.toArray()).toEqual(['Guilds']);
    client.destroy();
  });

  test('registers the temporary guild-scoped test command', async () => {
    const { client, guild } = fakeDiscord();
    const runtime = createGsbotRuntime({
      config,
      client,
      log: { info: jest.fn(), error: jest.fn() }
    });

    await runtime.start();

    expect(client.guilds.fetch).toHaveBeenCalledWith(config.guildId);
    expect(guild.commands.set).toHaveBeenCalledWith(commandPayload([testCommand]));
    expect(commandPayload([testCommand])).toEqual([
      expect.objectContaining({
        name: 'test',
        description: expect.stringContaining('GSbot')
      })
    ]);
  });

  test('answers /test ephemerally and closes the client during shutdown', async () => {
    const { client } = fakeDiscord();
    const log = { info: jest.fn(), error: jest.fn() };
    const runtime = createGsbotRuntime({ config, client, log });
    await runtime.start();
    const interaction = {
      commandName: 'test',
      guildId: config.guildId,
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
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('GSbot command complete'));
    await runtime.stop();
    expect(client.destroy).toHaveBeenCalledTimes(1);
  });

  test('destroys the client when command registration fails', async () => {
    const { client, guild } = fakeDiscord();
    guild.commands.set.mockRejectedValue(new Error('Discord unavailable'));
    const runtime = createGsbotRuntime({
      config,
      client,
      log: { info: jest.fn(), error: jest.fn() }
    });

    await expect(runtime.start()).rejects.toThrow('GSbot startup failed: Discord unavailable');
    expect(client.destroy).toHaveBeenCalledTimes(1);
  });
});
