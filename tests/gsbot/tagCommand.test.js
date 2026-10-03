const { Collection, MessageFlags } = require('discord.js');
const ScheduledJob = require('../../src/core/models/ScheduledJob');
const TemporaryTag = require('../../src/core/models/TemporaryTag');
const TemporaryTagInvite = require('../../src/core/models/TemporaryTagInvite');
const tagCommand = require('../../src/gsbot/commands/tagCommand');

const guildId = '123456789012345678';
const userId = '323456789012345678';

function interaction(overrides = {}) {
  const role = { id: '423456789012345678', delete: jest.fn().mockResolvedValue(undefined) };
  const message = { id: '523456789012345678', delete: jest.fn().mockResolvedValue(undefined) };
  const values = { tag: null };
  return {
    guildId,
    channelId: '623456789012345678',
    user: { id: userId },
    member: { roles: { cache: new Collection() } },
    guild: {
      roles: {
        create: jest.fn().mockResolvedValue(role),
        fetchMemberCounts: jest.fn().mockResolvedValue(new Collection())
      },
      members: {
        addRole: jest.fn().mockResolvedValue(undefined),
        removeRole: jest.fn().mockResolvedValue(undefined)
      }
    },
    channel: { send: jest.fn().mockResolvedValue(message) },
    options: {
      getSubcommand: () => 'list',
      getString: (name) => values[name],
      getFocused: () => ''
    },
    fields: { getTextInputValue: () => '' },
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    showModal: jest.fn().mockResolvedValue(undefined),
    respond: jest.fn().mockResolvedValue(undefined),
    isAutocomplete: () => false,
    ...overrides,
    _role: role,
    _message: message,
    _values: values
  };
}

async function createTag(overrides = {}) {
  return TemporaryTag.create({
    guildId,
    discordRoleId: '423456789012345678',
    name: 'Halloween',
    normalizedName: 'halloween',
    buttonLabel: '🎃 Partecipa',
    createdBy: userId,
    ...overrides
  });
}

describe('/tag', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('registers all commands and autocomplete selectors', () => {
    const payload = tagCommand.data.toJSON();
    expect(payload.default_member_permissions).toBe('0');
    expect(payload.options.map(({ name }) => name)).toEqual([
      'create',
      'invite',
      'info',
      'list',
      'delete'
    ]);
    for (const name of ['invite', 'info', 'delete']) {
      const option = payload.options.find((entry) => entry.name === name).options[0];
      expect(option).toMatchObject({ name: 'tag', required: true, autocomplete: true });
    }
  });

  test('opens a modal and creates a zero-permission non-mentionable role', async () => {
    const slash = interaction({
      options: { getSubcommand: () => 'create' }
    });
    await tagCommand.execute(slash);
    expect(slash.showModal).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.anything() })
    );

    const fields = {
      name: 'Halloween',
      button_label: '🎃 Partecipa a Halloween',
      expires_at: '01/11/2026 12:00'
    };
    const modal = interaction({
      fields: { getTextInputValue: (name) => fields[name] }
    });
    await tagCommand.handleInteraction(
      {
        ...modal,
        customId: 'tag:create',
        isModalSubmit: () => true,
        isButton: () => false
      },
      {}
    );
    expect(modal.guild.roles.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Halloween',
        permissions: [],
        hoist: false,
        mentionable: false
      })
    );
    expect(await TemporaryTag.findOne({ guildId })).toMatchObject({
      name: 'Halloween',
      buttonLabel: '🎃 Partecipa a Halloween',
      status: 'active'
    });
    expect(await ScheduledJob.countDocuments({ type: 'temporary_tag_expiration' })).toBe(1);
  });

  test('publishes and tracks multiple invites for a managed tag', async () => {
    const tag = await createTag();
    for (const id of ['523456789012345678', '523456789012345679']) {
      const command = interaction({
        options: {
          getSubcommand: () => 'invite',
          getString: () => tag.id
        },
        channel: {
          send: jest.fn().mockResolvedValue({ id, delete: jest.fn().mockResolvedValue(undefined) })
        }
      });
      await tagCommand.execute(command);
      expect(command.channel.send).toHaveBeenCalledWith({ components: expect.any(Array) });
    }
    expect(await TemporaryTagInvite.countDocuments({ tagId: tag._id })).toBe(2);
  });

  test('toggles only an active managed role and returns the standard confirmation', async () => {
    const tag = await createTag();
    const button = interaction({
      customId: `tag:toggle:${tag.id}`,
      isModalSubmit: () => false,
      isButton: () => true
    });
    await tagCommand.handleInteraction(button, {});
    expect(button.guild.members.addRole).toHaveBeenCalledWith(
      expect.objectContaining({ user: userId, role: tag.discordRoleId })
    );
    expect(button.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: `Hai ricevuto il tag <@&${tag.discordRoleId}> - Clicca di nuovo sul bottone per rimuoverti`,
        flags: MessageFlags.Ephemeral
      })
    );

    const removal = interaction({
      member: {
        roles: {
          cache: new Collection([[tag.discordRoleId, {}]])
        }
      },
      customId: `tag:toggle:${tag.id}`,
      isModalSubmit: () => false,
      isButton: () => true
    });
    await tagCommand.handleInteraction(removal, {});
    expect(removal.guild.members.removeRole).toHaveBeenCalledWith(
      expect.objectContaining({ user: userId, role: tag.discordRoleId })
    );

    const unmanaged = interaction({
      customId: 'tag:toggle:not-a-managed-tag',
      isModalSubmit: () => false,
      isButton: () => true
    });
    await tagCommand.handleInteraction(unmanaged, {});
    expect(unmanaged.guild.members.addRole).not.toHaveBeenCalled();
    expect(unmanaged.reply.mock.calls[0][0].content).toContain('non è più attivo');
  });

  test('uses Discord member counts, filters autocomplete, and requires delete confirmation', async () => {
    const active = await createTag();
    await createTag({
      discordRoleId: '423456789012345679',
      name: 'Natale',
      normalizedName: 'natale',
      status: 'deleted',
      deletedAt: new Date()
    });
    const counts = new Collection([[active.discordRoleId, 7]]);
    const info = interaction({
      options: { getSubcommand: () => 'info', getString: () => active.id }
    });
    info.guild.roles.fetchMemberCounts.mockResolvedValue(counts);
    await tagCommand.execute(info);
    expect(info.editReply.mock.calls[0][0].content).toContain('Membri: 7');

    const autocomplete = interaction({
      options: { getFocused: () => 'hall' },
      isAutocomplete: () => true
    });
    await tagCommand.autocomplete(autocomplete);
    expect(autocomplete.respond).toHaveBeenCalledWith([{ name: 'Halloween', value: active.id }]);

    const remove = interaction({
      options: { getSubcommand: () => 'delete', getString: () => active.id }
    });
    remove.guild.roles.fetchMemberCounts.mockResolvedValue(counts);
    await tagCommand.execute(remove);
    expect(remove.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Eliminare'),
        components: expect.any(Array)
      })
    );
    expect((await TemporaryTag.findById(active.id)).status).toBe('active');

    const cleanup = { cleanup: jest.fn().mockResolvedValue({ status: 'deleted' }) };
    const confirmation = interaction({
      customId: `tag:delete:confirm:${active.id}:${userId}`,
      isModalSubmit: () => false,
      isButton: () => true
    });
    await tagCommand.handleInteraction(confirmation, { temporaryTagCleanup: cleanup });
    expect(confirmation.deferUpdate).toHaveBeenCalledTimes(1);
    expect(cleanup.cleanup).toHaveBeenCalledWith(expect.objectContaining({ id: active.id }), {
      deletedBy: userId
    });
  });

  test('handles commands without a GSbot-specific staff role check', async () => {
    const command = interaction({ member: { roles: { cache: new Collection() } } });
    await tagCommand.execute(command);
    expect(command.deferReply).toHaveBeenCalledTimes(1);
    expect(command.editReply.mock.calls[0][0].content).toBe('Nessun tag temporaneo attivo.');
  });
});
