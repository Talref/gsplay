# GSPlay v2 development preview

> **Status: v2 is the current application.** Legacy v1 remains preserved in the `v1-final` tag and optional `legacy-v1` branch; it is not part of this runtime tree.

For staging rehearsal, cutover gates, and rollback boundaries, see [V2-Cutover-Runbook.md](./V2-Cutover-Runbook.md). This is not authorization to cut over production.

## What this preview includes

- Cookie-based signup, login, refresh, and logout.
- SteamID64 linking plus durable Steam sync jobs.
- CSV/JSON imports for GOG, Epic, and Amazon-shaped exports.
- Authoritative library entitlements, server-side comparison, and admin match review APIs.
- Canonical catalogue search, durable exact-match IGDB enrichment, plus RetroAchievements profiles and an admin-managed active community challenge.
- Responsive v2 frontend at the Vite address.

## Prerequisites

- Node.js and npm.
- A **disposable local MongoDB** instance.
- Three terminals for API, worker, and frontend.

## Configure the environment

```bash
cp .env.example .env
```

In `.env`, keep the development defaults and replace both JWT secrets with unique random values of at least 32 characters:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Set `STEAM_API_KEY` only when testing a Steam sync. Set `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` only when testing worker-based canonical-game enrichment. Set the RetroAchievements variables only when testing that integration. Never commit `.env`.

IGDB enrichment is queued durably and runs only in the worker. On each worker start (and every `IGDB_MAINTENANCE_MS`, 15 minutes by default), a recovery scan reclaims expired leases and queues a bounded number of eligible pending/retryable records. The worker defaults to one IGDB request every 500ms, emits `🧠 IGDB` lifecycle/progress logs, and cools down for 60 seconds after a rate limit. Do not run more than one v2 enrichment worker against the same free IGDB credentials until a distributed provider rate gate is introduced.

## Start v2

In the repository root, prepare non-destructive v2 indexes and start the API:

```bash
npm run bootstrap
npm start
```

In a second terminal, start the durable job worker:

```bash
npm run worker
```

In a third terminal, start the frontend:

```bash
cd gsplay-frontend
npm run dev -- --host 0.0.0.0
```

Open <http://localhost:5173>.

`npm start` / `npm run dev` start the v2 API. `npm run worker` starts the durable worker.

## Manual smoke test

1. Sign up, log out, log back in, then refresh the page.
2. On **Library**, link a valid 17-digit SteamID64 and queue a sync (requires `STEAM_API_KEY`).
3. Queue a small CSV or JSON import for GOG, Epic, or Amazon; the Library screen polls the job and displays its terminal counts/diagnostics.
4. Create a second account and compare the two libraries.
5. Link a RetroAchievements username and load its profile if credentials are configured. An admin can activate one RetroAchievements game ID from **Admin**; linked members then see their own progress for the active challenge.
   Admins can also queue an on-demand, durable IGDB refresh for a canonical game with `POST /api/v2/admin/games/:gameId/metadata-refresh`. The request is coalesced if that game already has a queued or running refresh; it never calls IGDB synchronously.
   If an early development worker left records as terminal `permanent_error`, an admin may make them eligible for the safe recovery scan with `POST /api/v2/admin/enrichment-recover-permanent`. This is a deliberate development recovery operation, not an automatic infinite retry loop.
6. Promote a test user only in the disposable development database to inspect admin APIs:

   ```javascript
   use gsplay
   db.users_v2.updateOne(
     { usernameNormalized: 'yourname' },
     { $set: { role: 'admin' } }
   )
   ```

## Upload file contract

The current preview accepts a safe, provider-neutral UTF-8 format; it does **not** yet parse arbitrary downloaded vendor exports.

CSV must have this exact header and two columns (quoted commas are supported):

```csv
providerGameId,providerTitle
gog-42,"Quest, The"
```

JSON must be either a game array or an object with a `games` array:

```json
[{ "providerGameId": "epic-1", "providerTitle": "Aqua Quest" }]
```

Each record must contain non-empty string values for `providerGameId` and `providerTitle`. Files must be UTF-8 text, cannot contain NUL/binary data, and are limited to 5,000 records and the configured upload byte limit.

When the matching provider is selected in the upload form, the v2 preview also accepts the repository-supported legacy-shaped JSON contracts below. They are normalized and fully validated by the v2 parser; unsupported shapes are rejected rather than guessed:

```json
// GOG
{ "games": [{ "title": "Aqua Quest", "app_name": "gog-42" }] }

// Epic or Amazon
{ "library": [{ "title": "Aqua Quest", "app_name": "store-42" }] }
```

## Known preview limitations

- Imported/provider titles create provisional canonical records when no exact normalized match exists, so a fresh library can participate in Compare and Catalogue. The worker queues IGDB enrichment for each new provisional game, but applies metadata only when the search produces exactly one normalized-title match; broader matching and scheduled metadata refresh are not complete.
- The admin screen resolves ambiguous titles against the currently loaded canonical catalogue. Large catalogues need a dedicated paginated search picker in a later UX pass.
- The preview supports the documented neutral format plus the repository-supported GOG/Epic/Amazon JSON shapes above. Representative sanitized fixtures are still required before claiming compatibility with arbitrary current vendor-export variants.
- This is not a production cutover. A staged rehearsal/rollback runbook now exists, but its required evidence and no-go items remain open.

## Quality checks

```bash
npm run test:v2

cd gsplay-frontend
npm run build
npm run lint
npm run test:e2e
```

The current frontend lint configuration covers the active v2 application and must pass without warnings or errors.

`npm run test:e2e` launches an entirely disposable in-memory MongoDB, an isolated v2 API on `127.0.0.1:3100`, and a Vite server on `127.0.0.1:5174`. It never reads the development database or `.env`, and tears down the test services when it finishes. The Playwright matrix covers 360, 390, 768, 900, 1280, and 1440 pixel widths for protected-route handling, signup/logout, library feedback, catalogue search, and server-side shared-library comparison. It intentionally does not make live Steam, IGDB, or RetroAchievements calls; those belong to the staged rehearsal in the cutover runbook.