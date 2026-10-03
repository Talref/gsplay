const { Client, Events, GatewayIntentBits, MessageFlags } = require('discord.js');
const testCommand = require('./commands/testCommand');
const birthdayCommand = require('./commands/birthdayCommand');
const tagCommand = require('./commands/tagCommand');

const DEFAULT_COMMANDS = [testCommand, birthdayCommand, tagCommand];

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
  delivery = null,
  interactionContext = {},
  onStop = null,
  log = console
}) {
  const commandByName = new Map(commands.map((command) => [command.data.name, command]));
  let started = false;
  let stopped = false;

  client.on(Events.Error, (error) => {
    log.error(`GSbot Discord client error: ${error.message}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.guildId !== config.guildId) return;
    const command = interaction.commandName
      ? commandByName.get(interaction.commandName)
      : commands.find((candidate) => candidate.handles?.(interaction));
    if (!command) return;
    try {
      if (interaction.isAutocomplete?.()) await command.autocomplete?.(interaction);
      else if (interaction.isChatInputCommand?.()) await command.execute(interaction);
      else await command.handleInteraction?.(interaction, interactionContext);
      log.info(
        `GSbot interaction complete · command=${interaction.commandName ? `/${interaction.commandName}` : interaction.customId} · guild=${interaction.guildId} · user=${interaction.user?.id || 'unknown'}`
      );
    } catch (error) {
      log.error(
        `GSbot interaction failed · command=${interaction.commandName || interaction.customId}: ${error.message}`
      );
      if (interaction.isAutocomplete?.()) {
        if (!interaction.responded) await interaction.respond([]).catch(() => undefined);
      } else if (interaction.deferred && interaction.editReply) {
        await interaction
          .editReply({ content: 'Operazione non riuscita. Riprova.', components: [] })
          .catch(() => undefined);
      } else if (!interaction.replied && interaction.reply) {
        await interaction
          .reply({ content: 'Operazione non riuscita. Riprova.', flags: MessageFlags.Ephemeral })
          .catch(() => undefined);
      }
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
          delivery?.start();
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
    await delivery?.stop();
    client.destroy();
    await onStop?.();
    log.info('GSbot stopped cleanly');
  }

  return { client, start, stop };
}

module.exports = { commandPayload, createGsbotClient, createGsbotRuntime };
