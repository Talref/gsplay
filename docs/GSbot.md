# GSbot

GSbot is the repository's Discord runtime. It owns Discord command definitions, interaction replies,
public message delivery, and Gateway lifecycle. Runtime-neutral records, scheduling, and domain logic
remain in `src/core`; due-time processing remains in the worker.

## Configuration

`GSBOT_TOKEN` and `GSBOT_GUILD_IDS` are bootstrap values in the protected runtime environment.
Feature channel mappings live in MongoDB so adding bot functions does not create an expanding set of
environment variables. `GSBOT_GUILD_IDS` is a comma-separated allowlist and is not secret. One
runtime registers commands and handles interactions and scheduled deliveries in every listed guild.
`GSBOT_GUILD_ID` remains accepted as a single-guild migration fallback when the new setting is empty.
Missing or invalid configuration fails startup; there is no production fallback in source.

Configure the semantic `general` channel after the first deployment, and whenever that channel
changes:

```bash
sudo -u gsplay /usr/bin/node /srv/gsplay/scripts/configure-gsbot.js \
  --guild-id <Discord server ID> \
  --general-channel-id <Discord general channel ID>
```

Run the command once for each configured guild from an environment where `MONGO_URI` is available.
Each guild's `general` channel is public and receives its birthday reminders. Birthday messages
allow a mention of the birthday user only; role, `@everyone`, and additional user mentions are
suppressed. GSbot needs View Channel and Send Messages permission there; it does not need
Administrator.

## Commands

### Diagnostics

- `/test` — replies privately with a basic runtime status. No arguments.

### Birthday

- `/birthday set day:<1-31> month:<1-12> [year:<1-9999>]` — privately stores or replaces the
  invoking user's birthday and schedules its next occurrence for 00:01 Europe/Rome.
- `/birthday remove` — privately removes the invoking user's birthday and cancels its pending
  reminder.
- `/birthday show [user:<Discord user>]` — privately shows the selected user's stored birthday, or
  the invoking user's birthday when `user` is omitted. It does not calculate or display age.
- `/birthday test` — privately renders a randomized birthday message through the same renderer used
  for delivery. It does not consume, create, or reschedule a reminder.

February 29 birthdays run on February 28 in non-leap years. Real reminders are persistent and are
delivered to the configured `general` channel after worker processing, including after runtime
downtime.

`/birthday` is available to ordinary members by default. All four subcommands reply privately.

### Administration

- `/gsbot birthday-channel channel:<Discord channel>` — privately updates `channels.general`, the
  destination for future birthday reminders, for the invoking server only. The required channel
  must be a guild text or announcement channel. It replaces `/birthday channelset`.

`/gsbot` requires Discord's Manage Server permission by default. Server managers can authorize
specific staff roles or members through **Server Settings → Integrations → GSbot → Command
Permissions → `/gsbot`**, including staff without Manage Server. GSbot relies on Discord's command
permissions and does not add a separate in-handler permission check or staff-role mapping.

After deployment, review **Server Settings → Integrations → GSbot → Command Permissions** in every
configured server. Existing customized command permissions may need adjustment; registering the
updated commands does not guarantee that Discord resets those overrides. Ensure `/birthday` is
available to members and `/gsbot` is limited to the intended staff. In a test guild, verify all four
birthday subcommands as an ordinary member, then verify channel configuration as authorized staff
(including a role without Manage Server) and its restriction for other members before granting
member access in production. `/tag` permissions are unchanged.

This change requires no database migration or environment-variable changes. Existing birthdays,
reminder scheduling, delivery, and message formatting are unchanged.

### Temporary tags

- `/tag create` — opens a modal for a name, button label, and optional `GG/MM/AAAA HH:mm`
  expiration in Europe/Rome.
- `/tag invite <tag>` — publishes the tag's self-service button in the current channel.
- `/tag info <tag>` and `/tag list` — show current Discord member counts and lifecycle details.
- `/tag delete <tag>` — asks for confirmation, deletes the Discord role, and disables every invite.

Temporary roles have no permissions, are not hoisted, and are not mentionable. Expiration uses the
persistent scheduled-job handoff and performs the same cleanup as manual deletion.

All Discord-derived state, records, channel configuration, temporary tags and invites, and scheduled
work are scoped by guild. Commands update only the guild where they run, and delivery workers claim
work only for the configured guild allowlist. New GSbot features must preserve that isolation and
must not assume there is only one guild.

`/tag` requires Discord's Manage Server permission by default. Server managers can grant the
intended staff roles or members access through **Server Settings → Integrations → GSbot → Command
Permissions → `/tag`**. This is Discord operational configuration; GSbot does not maintain a
separate staff-role mapping. GSbot itself still needs Manage Roles, and its highest role must remain
above the temporary roles it creates.

### Moderation

All `/mod` responses are ephemeral and all records are scoped to the originating guild:

- `/mod strike user:<user> reason:<text>` — records a manual disciplinary intervention; it does
  not kick, ban, mute, or timeout the member.
- `/mod note user:<user> message:<text>` — appends a general note, preserving the original text.
- `/mod view user:<user>` — shows lifetime counts by action, strikes, notes, the three latest note
  texts with their authors, and three recent events.
- `/mod audit user:<user>` — shows the eight latest events, newest first, including moderators,
  original reasons/messages, timeout expiry where applicable, and Discord audit entry IDs.
- `/mod last` — shows the ten latest records across all users in this guild, including synced
  Discord events, strikes, and notes. Includes targets and moderators with explicit Discord IDs,
  original reasons/messages (abbreviated), and audit IDs where available. Results use up to two
  embeds in one private response; timestamps use Europe/Rome.
- `/mod sync` — retrieves the previous 30 days of Discord audit entries for this guild. Reports
  scanned, inserted, skipped (unsupported entries or duplicates), and failed counts. API fetch
  failures explicitly mark the result incomplete; write failures are counted and processing
  continues. Repeat the command to recover failed or missed entries. Only one sync runs per guild.

`/mod` defaults to Manage Server, matching the existing staff commands. Configure **Server Settings →
Integrations → GSbot → Command Permissions → `/mod`** to grant access to the moderator team and
restrict it for other members. Discord enforces the command permissions; GSbot deliberately has no
additional staff-role mapping, handler permission gate, or administrator-only sync restriction.
After registration, verify all six subcommands as an authorized moderator without Manage Server,
then verify that an ordinary member cannot invoke them. Existing integration overrides may need
adjustment. These are private operational tools; no moderation messages are posted publicly.

GSbot needs **View Audit Log** in every configured guild for both live ingestion and sync.
The runtime requests the non-privileged **GuildModeration** Gateway intent alongside Guilds;
no privileged intent or Administrator permission is needed. Granting moderation-action permissions
such as Ban Members is unnecessary because these commands only record and read history.
See Discord's [audit log reference](https://docs.discord.com/developers/resources/audit-log) and
[Gateway event reference](https://docs.discord.com/developers/events/gateway-events#guild-audit-log-entry-create).

Live ingestion and sync share the same classifier for kicks, bans, unbans, timeout application or
extension, early timeout removal, and voice server mute/unmute. Natural timeout expiry is not
recorded as an early removal. One Discord audit entry can include both timeout and mute changes:
it is stored once with both actions, counted separately in the summary and displayed together in
the history. The original reason, moderator ID (nullable), target ID, timestamp, timeout change data,
and audit ID are retained without requiring the user to remain in the guild. Missing metadata is
shown explicitly. IDs remain authoritative; names are only display labels.

History and note previews are bounded to fit Discord embed limits, with totals and explicit
abbreviation notices. Stored text is never truncated; displayed reasons/messages are abbreviated
and escaped, mentions are suppressed, and times use Europe/Rome. There is no older-history browser
or annotation command in this release.

The standard bootstrap creates `moderation_events` with a partial unique `(guildId, discordAuditId)`
index for Discord records and guild/target/date and guild/date history indexes. Run the normal
bootstrap to create the guild/date index when upgrading for `/mod last`. No existing records are
migrated and no new environment variables are needed. Every record starts with `annotations: []`; each future
annotation supports its own ID, author, message, and creation time. Original events and manual notes
are append-only through the model; only annotation appends are accepted as model updates. The
existing guild reset script retains moderation history.

Before production use, grant View Audit Log, configure `/mod` access, restart GSbot to register
commands/intents, and run the normal bootstrap. In a test guild, record a strike and a note, verify
the note text in `/mod view`, perform native moderation actions, inspect `/mod audit`, and repeat
`/mod sync` to verify that the second run inserts no duplicates. No credentials or live Discord
access are required by the automated tests.
