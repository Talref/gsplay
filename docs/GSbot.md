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
- `/birthday channelset channel:<Discord channel>` — privately updates the destination for future
  birthday reminders in the current server.

February 29 birthdays run on February 28 in non-leap years. Real reminders are persistent and are
delivered to the configured `general` channel after worker processing, including after runtime
downtime.

`/birthday` requires Discord's Manage Server permission by default. Server managers can adjust
access through **Server Settings → Integrations → GSbot → Command Permissions → `/birthday`**;
GSbot does not maintain a separate operator-role mapping.

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
