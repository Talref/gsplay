# Dr. Racoon implementation tracking

Issue: https://github.com/Talref/gsplay/issues/68

## Delivery sequence

1. Configuration, prompt compiler and CLI; fixture-based verification.
2. Durable request model, bounded admission, leases, recovery and shared reply-chain history.
3. Provider transport, streaming and bounded structured tool orchestration.
4. Discord message lifecycle with persisted delivery checkpoints and recovery.
5. Gateway integration, authorization, queue consumer and independent process lifecycle.
6. Systemd/deploy integration, operational documentation and full acceptance checks.

Each slice is a separate PR. Merge after backend tests, backend/frontend lint and frontend build.
Keep deployment enablement until the final slice. No changes to existing worker job contracts.

Implementation and automated acceptance are complete. The first five slices were merged as
[configuration/prompts #69](https://github.com/Talref/gsplay/pull/69),
[queue/history #70](https://github.com/Talref/gsplay/pull/70),
[inference/tools #71](https://github.com/Talref/gsplay/pull/71),
[message lifecycle #72](https://github.com/Talref/gsplay/pull/72), and
[runtime integration #73](https://github.com/Talref/gsplay/pull/73).
The final slice supplies deployment, operator documentation and deployment simulations.
Verification: 53 backend suites / 327 tests, backend/frontend lint, frontend production build,
both production dependency audits and systemd unit verification. Live acceptance remains pending.

## Agreed decisions

- Other members may continue a reply chain. History remains guild/channel/scope-bound; author
  roles and bot/channel access are rechecked before inference and delivery.
- Staff destinations are an explicit comma-separated environment allowlist, like guild IDs.
  Staff scope also requires an explicitly configured role belonging to the originating guild.
- Operator-owned include symlinks may point outside `/etc/gsplay/prompts`; OS/sandbox access
  still applies. Document precise read-only host overrides or copying files when needed.
- Conversation bodies expire after seven days; minimal job/deduplication metadata after 30 days.
- Context remains bounded with required prompt/current request/output taking priority. A user-facing
  context warning is deferred to a future issue.
- Only explicitly configured guilds are enabled, initially the operator's staging guild.

## Acceptance boundary

Automated tests use MongoMemoryServer, fake Discord and fake HTTP inference; no credentials.
Live acceptance remains pending until the operator creates/invites the separate Discord app,
sets environment values, provisions knowledge files and deploys. Verify mention/reply/shared-chain
continuation, staff isolation, provider outage, restart recovery and independent disablement there.
