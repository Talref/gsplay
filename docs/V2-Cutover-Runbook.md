# GSPlay v2 cutover rehearsal and rollback runbook

> **Status: rehearsal document only.** Do not replace the legacy v1 entry point, routes, database, or deployment process until every precondition below is signed off. v2 is currently an isolated preview.

## Safety boundaries

- v2 stores only in `*_v2` MongoDB collections and the bootstrap script creates indexes only.
- `npm run bootstrap:v2` must never migrate, rename, drop, or update v1 collections.
- `server.js`, legacy routes, and `deploy.sh` stay untouched through rehearsal.
- Use an environment-specific least-privilege MongoDB credential. Do not use a production root credential in local or staging `.env` files.
- Keep v1 and v2 behind separate process names, ports, health checks, and logs until final approval.

## Required evidence before a staging rehearsal

- [ ] A reviewed configuration file exists using production-strength, independent access/refresh JWT secrets and explicit `CORS_ORIGINS`.
- [ ] The v2 database user can access only the v2 target database/collections required for the preview.
- [ ] A tested, encrypted backup/snapshot of the target MongoDB environment exists, with restore ownership and retention documented.
- [ ] v2 quality checks pass from a clean checkout:

  ```bash
  npm ci
  npm run test:v2
  cd gsplay-frontend && npm ci && npm run build && npm run lint
  ```

- [ ] Provider keys are configured only in the process secret store. They never appear in browser builds, git, logs, screenshots, or tickets.
- [ ] Representative sanitized GOG/Epic/Amazon export fixtures have passed the finalized parsers. Until then, use only the documented neutral import format.
- [ ] Browser verification has covered anonymous, member, and admin flows at 360, 390, 768, 900, 1280, and 1440 px widths.

## Staging rehearsal

1. **Provision isolated v2 services.** Deploy the v2 API, worker, and static frontend with distinct service names and a staging-only hostname/path. Do not proxy `/api/v2` through production v1 yet.
2. **Configure and index.** Inject staging secrets, then run once:

   ```bash
   npm run bootstrap:v2
   ```

   Record the command output and verify it names only v2 collections.
3. **Start order.** Start API, wait for `/health/live` and database-backed `/health/ready` to return success, then start the worker. Confirm structured request logs include request IDs without secrets.
4. **Identity/session smoke test.** Create two disposable accounts; verify signup, login, refresh, logout, invalid credential rejection, and member-only route rejection while anonymous.
5. **Library/job smoke test.** Link a test SteamID64 only where permitted, queue one import in the neutral format, verify the job transitions visibly, and verify canonical/library comparison DTOs never include other users’ complete libraries.
6. **Admin smoke test.** Promote only a disposable staging user to `admin`; review/resolve an ambiguous title and activate a Retro challenge. Confirm a member sees only their own Retro progress.
7. **Failure drill.** Temporarily stop the worker and verify queued jobs remain durable; restart it and observe recovery. Simulate an unavailable provider credential and verify a safe diagnostic rather than an API crash.
8. **Record results.** Capture exact image/artifact identifiers, deployed commit, timestamps, health output, test accounts, failures, and rollback decision owner.

## Go/no-go criteria

Proceed only when all required evidence and rehearsal steps are checked, product owners approve the v2 functional scope, monitoring/alert ownership is assigned, and a rollback owner is on call. The known missing items—IGDB enrichment, true vendor-export adapters, broad E2E coverage, and final responsive matrix—are currently **no-go** items for production cutover.

## Rollback procedure

1. Announce rollback and freeze v2 admin mutations/import submissions.
2. Remove the v2 frontend route or reverse-proxy target; direct traffic back to unchanged v1 only if v1 is still the approved production system.
3. Stop the v2 worker first, then the v2 API. Preserve v2 logs and job records for incident analysis; do not delete collections as part of rollback.
4. Validate v1 health checks and essential user paths. Declare recovery only after monitoring confirms stable traffic and error rates.
5. Open an incident/rehearsal record with request IDs, job IDs, provider diagnostics, timestamps, and the exact deployed revision. Remediate in a new v2 rehearsal—never patch legacy internals as a shortcut.

## Final cutover follow-up

After a successful approved cutover, retain read-only v1 backups according to policy, monitor v2 authentication/job/provider failure rates, and schedule a separately approved legacy retirement plan. Data deletion or legacy schema changes require their own reviewed runbook.