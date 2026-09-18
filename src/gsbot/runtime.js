const { Client, Events, GatewayIntentBits } = require('discord.js');
const testCommand = require('./commands/testCommand');

const DEFAULT_COMMANDS = [testCommand];

function createGsbotClient() {
  return new Client({ intents: [GatewayIntentBits.Guilds] });
}

function commandPayload(commands) {
  return commands.map((command) => command.data.toJSON());
}

function createGsbotRuntime({
  config,
  client = createGsbotClient(),
  commands = DEFAULT_COMMANDS,
  log = console
}) {
  const commandByName = new Map(commands.map((command) => [command.data.name, command]));
  let started = false;
  let stopped = false;

  client.on(Events.Error, (error) => {
    log.error(`GSbot Discord client error: ${error.message}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.guildId !== config.guildId) return;
    const command = commandByName.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
      log.info(
        `GSbot command complete · command=/${interaction.commandName} · guild=${interaction.guildId} · user=${interaction.user?.id || 'unknown'}`
      );
    } catch (error) {
      log.error(`GSbot command failed · command=/${interaction.commandName}: ${error.message}`);
    }
  });

  async function start() {
    if (started) return;
    const ready = new Promise((resolve, reject) => {
      client.once(Events.ClientReady, async (readyClient) => {
        try {
          const guild = await readyClient.guilds.fetch(config.guildId);
          await guild.commands.set(commandPayload(commands));
          started = true;
          log.info(`GSbot ready · guild=${guild.name} (${guild.id}) · commands=${commands.length}`);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

    try {
      await client.login(config.token);
      await ready;
    } catch (error) {
      client.destroy();
      throw new Error(`GSbot startup failed: ${error.message}`, { cause: error });
    }
  }

  async function stop() {
    if (stopped) return;
    stopped = true;
    client.destroy();
    log.info('GSbot stopped cleanly');
  }

  return { client, start, stop };
}

module.exports = { commandPayload, createGsbotClient, createGsbotRuntime };
