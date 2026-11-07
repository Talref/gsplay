# Dr. Racoon

Dr. Racoon is the community's conversational AI Discord application. GSbot remains a separate
application for deterministic commands. Dr. Racoon runs in one independent Node.js service,
with a dedicated MongoDB queue and an asynchronous in-process consumer. It does not use the
GSPlay worker, register slash commands or start/restart an inference server.

## Staging setup

1. Create a separate application in the [Discord Developer Portal](https://discord.com/developers/applications).
   Invite its bot to your staging/faux server before enabling the final community server.
2. Enable **Message Content Intent** under Bot. The client requests Guilds, GuildMessages and
   MessageContent, so replies that do not explicitly mention the bot can be read.
3. Grant View Channels, Read Message History, Send Messages and Send Messages in Threads where
   needed. Add the bot to private threads. Do not grant Administrator or Manage Roles.
4. Store its independent token and staging guild ID in `/etc/gsplay/v2.env`:

   ```dotenv
   DRRACOON_TOKEN=<the new application's bot token>
   DRRACOON_GUILD_IDS=<staging server ID>
   DRRACOON_STAFF_ROLE_IDS=<staff role ID>,<another staff role ID>
   DRRACOON_STAFF_CHANNEL_IDS=<private staff channel ID>,<another private channel ID>
   ```

   All ID lists are comma-separated numeric IDs, without brackets. Guild IDs form an allowlist,
   following GSbot's multi-guild pattern. Nothing enables the final server automatically.
   Empty staff lists are valid and leave all conversations in USER scope.

5. Provision the knowledge includes below, configure the provider and run the normal deployment.

Both token and guild list absent means disabled. A partial pair, invalid IDs, malformed URLs,
invalid numeric limits or an output budget exceeding context capacity fails preflight. No token
is logged or persisted in the queue. Local development uses an untracked `.env` and
`npm run dev:drracoon`; `npm run dev` continues to start the existing GSPlay processes only.

## Knowledge files and prompt inspection

The released templates are `src/drracoon/prompts/PROMPTUSER.md` and `PROMPTSTAFF.md`.
They identify Dr. Racoon separately from GSbot. Includes live at the fixed operator-owned path
`/etc/gsplay/prompts/`, outside the `rsync --delete` release tree. There are no prompt-path
environment variables. Create the directory and ensure the service account can traverse its parent:

```bash
sudo chgrp gsplay /etc/gsplay
sudo chmod 0750 /etc/gsplay
sudo install -d -o root -g gsplay -m 0750 /etc/gsplay/prompts
sudo install -o root -g gsplay -m 0640 /path/to/public-guide.md /etc/gsplay/prompts/MACHINEDOCS_USER.md
sudo install -o root -g gsplay -m 0640 /path/to/staff-guide.md /etc/gsplay/prompts/MACHINEDOCS_STAFF.md
```

Provide USER knowledge before enabling the bot. STAFF knowledge is required if both staff role
and channel lists are configured. Public knowledge must contain no staff-only information.
Operator-created symlinks are supported, for example instead of the USER copy:

```bash
sudo ln -s /opt/community-docs/public.md /etc/gsplay/prompts/MACHINEDOCS_USER.md
```

The target may be outside the include directory or repository. The `gsplay` account must be able
to traverse every parent and read the target. The unit deliberately uses `ProtectHome=read-only`
instead of making home directories inaccessible, so readable externally maintained home-directory
guides also work. `ProtectSystem=strict` makes other filesystem trees read-only; `PrivateTmp=true`
means host `/tmp` is unsuitable for persistent include targets. A symlink never bypasses OS
permissions, private mounts or a stricter operator systemd override. Copy/sync the guide into the
include directory if the source should remain inaccessible to the service account.
See [systemd's filesystem protections](https://freedesktop.org/software/systemd/man/latest/systemd.exec.html#ProtectHome=).

Inspect compilation without Discord or inference:

```bash
npm run drracoon:prompt -- user
npm run drracoon:prompt -- staff
sudo -u gsplay node /srv/gsplay/scripts/drracoon-prompt.js user
```

The last command also checks service-user file permissions outside systemd. Do not paste STAFF
output into public logs. The runtime compiles its required prompts inside the actual service
sandbox before reporting readiness. Future requests read updated templates/includes without a
restart. Placeholders accept only simple `.md` filenames such as `{{MACHINEDOCS_USER.md}}`;
paths, commands, nested includes, missing/unreadable files and malformed syntax fail explicitly.
Repeated includes expand at their original positions. Expanded prompts have a 128 KiB ceiling
and must also fit the configured context budget. There is no silent empty include or staff fallback.

## Authorization and shared conversations

Only actual mentions of this bot account and replies to its messages trigger work. Bot/self
messages, DMs, other guilds, plaintext names and unrelated messages are ignored. Accessible guild
text channels and unarchived/unlocked threads are supported.

STAFF requires both an explicitly configured role on the current guild member and a configured
destination channel. A thread may inherit its configured parent. The channel list is the operator's
privacy guarantee: configure actual private staff channels and keep their Discord permissions
correct. A staff member in a public destination gets USER. Missing role authorization gets USER.
Current membership, channel permissions and scope are rechecked before inference, tools and
message writes; stale queued authorization cannot grant access. Private threads additionally
require current requester membership.

Members may continue each other's reply chains. History follows only the referenced ancestry,
including any split response belonging to that request. A reply to an unfinished explanation waits
for its parent. History never crosses guild, channel/thread or USER/STAFF scope. An unknown, expired
or invalid chain starts fresh. The bot never scrapes the channel for conversational context.
At most 20 prior turns are loaded; oldest complete turns are trimmed first to fit context.
System prompt, current request and output reserve win. Context uses conservative UTF-8 byte
budgeting rather than a model-specific tokenizer, so it can trim earlier than the provider requires.
A user-facing context warning is deferred.

## Provider and tools

The default endpoint is `http://127.0.0.1:10743/v1`, model alias `gsbot-gemma`, with an optional
API key. The alias does not change the bot's identity. Change `DRRACOON_LLM_BASE_URL`,
`DRRACOON_LLM_MODEL` and `DRRACOON_LLM_API_KEY` for another explicitly chosen OpenAI-compatible
Chat Completions provider, including a remote provider. No paid-provider fallback occurs.
Keep local inference bound to loopback; no public API exposure is needed.

`DRRACOON_LLM_STREAM=true` enables SSE streaming; default false uses nonstreaming responses.
`DRRACOON_LLM_TOKEN_PARAMETER` defaults to `max_tokens` and may be `max_completion_tokens`
for providers requiring that shape. Provider-specific reasoning flags are not forced. Structured
reasoning fields and `<think>`/`<analysis>` blocks are excluded from visible output.
See the [Chat Completions protocol](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).

The request deadline covers all inference/tool rounds. Defaults are 32768 context tokens,
1024 output tokens, 120000 ms and three tool rounds. Each tool registration must supply its
schema, argument validator, permission predicate and implementation. Tool calls preserve IDs/order
and receive matching tool-result messages before subsequent inference. No production tools are
registered; fake tools test the complete protocol. No shell, filesystem or real GSPlay data tools
are exposed. Knowledge/tool output is reference data, not trusted instructions.

## Queue, recovery and Discord messages

`drracoon_requests` holds IDs, scope, ancestry, state, leases and message delivery checkpoints.
`drracoon_content` holds input and visible output; content expires after seven days. Terminal job
metadata/deduplication expires after 30 days. TTL deletion is asynchronous, so reads also enforce
content expiry. System prompts, hidden reasoning and tool transcripts are not persisted or logged.

One runtime instance is supported. Admission is serialized within that process; MongoDB claims
are atomic and leases are fenced/renewed. The default queue capacity is 20 admitted active jobs
(including running jobs), with one inference slot. Each member may have two active jobs per guild
and at most six admissions per minute; these limits survive restarts. Overflow/rate limits get an
explicit retry-later message. Jobs have a ten-minute admission deadline and at most three attempts.
Transient provider downtime/timeouts retry with bounded backoff while no visible answer was emitted.

The handler durably reserves a request before posting its placeholder, then queues asynchronous
work. Direct answers edit the placeholder. Visible preliminary tool text replaces it; subsequent
answer segments append as separate replies. Long segments split in order at Discord's 2000 UTF-16
unit limit. Streaming edits coalesce at 1.5-second intervals; turn boundaries force the final update.
Generated user/role/mass mentions and reply pings are disabled.

Every send saves an intent first, uses a deterministic enforced nonce and then saves its message ID.
Restart recovery reconciles a bounded window of this request's replies using the intent/nonce/hash.
This lookup is delivery reconciliation only and never becomes LLM history. If an old ambiguous send
cannot be identified, the job fails rather than blindly reposting. Deleted responses are not
silently replaced. Saved final answers can resume delivery without calling the model again.
Interrupted visible/tool-stage inference fails safely rather than replaying tool work; ask again
to start a new request. Graceful shutdown aborts inference and defers unfinished work.

Terminal errors replace known placeholders where permissions still allow it. If Discord deletes a
message or revokes access, editing may be impossible; the job still becomes failed and the Gateway
continues. Operator disablement leaves deferred work for the next enabled start.

## Deploy, disable and diagnose

Use the existing workflow:

```bash
git pull --ff-only origin master
./scripts/deploy.sh
```

Preflight validates configuration before publication. When enabled, staged prompt compilation and
context checks run as `gsplay` before publication. The installed unit checks actual sandbox access
at startup and writes `/run/gsplay-drracoon/ready` only after Discord login and configured-guild
verification. Deploy waits for that readiness and reports this service independently. LLM downtime
does not prevent Gateway readiness. API/worker/GSbot have no systemd dependency on this service.
The inference server is never restarted by GSPlay deployment.

To disable independently, clear both `DRRACOON_TOKEN` and `DRRACOON_GUILD_IDS` in the protected
environment file and deploy; deploy stops/disables `gsplay-drracoon.service`. Clearing only one
setting is an error. Direct `npm run drracoon` exits cleanly when disabled.

```bash
sudo systemctl status gsplay-drracoon.service
sudo journalctl -u gsplay-drracoon.service -n 100 --no-pager
sudo -u gsplay bash -c 'set -a; source /etc/gsplay/v2.env; set +a; exec node /srv/gsplay/scripts/check-drracoon-config.js --prompts'
```

Logs contain request IDs, guild IDs and bounded failure codes, not message bodies or credentials.
For missing knowledge, run the prompt CLI as `gsplay`; check symlink target permissions and any
systemd override if it succeeds outside the unit but startup fails. For missing triggers, check
the bot identity, guild allowlist, Message Content Intent and channel/thread permissions. For LLM
failures, check the configured endpoint, model, compatibility options and provider logs. Do not
run another consumer alongside the service to troubleshoot the queue.

## Release acceptance

Automated checks use MongoMemoryServer, fake Discord and fake inference, including a simulated
tool. After operator environment setup and deployment, verify in the staging guild:

1. Mention/reply once, ignore other messages/bots, and let a second member continue an explanation.
2. Confirm USER for staff in public; confirm STAFF only with a configured role and destination.
3. Exercise an allowed thread and a long answer; verify placeholder edit/ordered replies/no pings.
4. Temporarily stop the provider: Discord remains ready, errors settle and new messages still work.
5. Restart this service with pending work; check recovery without duplicate replies.
6. Disable/re-enable independently and verify GSbot/API/worker remain operational.

The live staging acceptance is pending operator setup/deployment. Final-guild rollout is separate.
