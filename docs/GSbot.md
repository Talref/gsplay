# GSbot

GSbot is the repository's Discord runtime. It owns Discord command definitions, interaction replies,
public message delivery, and Gateway lifecycle. Runtime-neutral records, scheduling, and domain logic
remain in `src/core`; due-time processing remains in the worker.

## Configuration

`GSBOT_TOKEN` and `GSBOT_GUILD_ID` are bootstrap values in the protected runtime environment.
Feature channel mappings live in MongoDB so adding bot functions does not create an expanding set of
environment variables.

Configure the semantic `general` channel after the first deployment, and whenever that channel
changes:

```bash
sudo -u gsplay /usr/bin/node /srv/gsplay/scripts/configure-gsbot.js \
  --guild-id "$GSBOT_GUILD_ID" \
  --general-channel-id 1338850451076026389
```

Run the command from an environment where `MONGO_URI` and `GSBOT_GUILD_ID` are available. The
current `general` channel is public and receives birthday reminders. Birthday messages allow a
mention of the birthday user only; role, `@everyone`, and additional user mentions are suppressed.
GSbot needs View Channel and Send Messages permission there; it does not need Administrator.

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
