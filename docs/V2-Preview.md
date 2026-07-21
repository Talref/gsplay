# GSPlay v2 local preview

> **Status: development preview.** v2 is isolated from the legacy v1 server and has not replaced the production entry point or deployment workflow.

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

## Start v2

In the repository root, prepare non-destructive v2 indexes and start the API:

```bash
npm run bootstrap:v2
npm run start:v2
```

In a second terminal, start the durable job worker:

```bash
npm run worker:v2
```

In a third terminal, start the frontend:

```bash
cd gsplay-frontend
npm run dev -- --host 0.0.0.0
```

Open <http://localhost:5173>.

`npm start`, `npm run dev`, `server.js`, and `deploy.sh` are legacy v1 entry points and intentionally remain unchanged.

## Manual smoke test

1. Sign up, log out, log back in, then refresh the page.
2. On **Library**, link a valid 17-digit SteamID64 and queue a sync (requires `STEAM_API_KEY`).
3. Queue a small CSV or JSON import for GOG, Epic, or Amazon; the Library screen polls the job and displays its terminal counts/diagnostics.
4. Create a second account and compare the two libraries.
5. Link a RetroAchievements username and load its profile if credentials are configured. An admin can activate one RetroAchievements game ID from **Admin**; linked members then see their own progress for the active challenge.
   Admins can also queue an on-demand, durable IGDB refresh for a canonical game with `POST /api/v2/admin/games/:gameId/metadata-refresh`. The request is coalesced if that game already has a queued or running refresh; it never calls IGDB synchronously.
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

## Known preview limitations

- Imported/provider titles create provisional canonical records when no exact normalized match exists, so a fresh library can participate in Compare and Catalogue. The worker queues IGDB enrichment for each new provisional game, but applies metadata only when the search produces exactly one normalized-title match; broader matching and scheduled metadata refresh are not complete.
- The admin screen resolves ambiguous titles against the currently loaded canonical catalogue. Large catalogues need a dedicated paginated search picker in a later UX pass.
- Real GOG/Epic/Amazon export adapters still need representative, sanitized export fixtures. The neutral upload contract above is the supported preview format today.
- This is not a production cutover. A staged rehearsal/rollback runbook now exists, but its required evidence and no-go items remain open.

## Quality checks

```bash
npm run test:v2

cd gsplay-frontend
npm run build
npm run lint
```

The current frontend lint configuration deliberately ignores obsolete, unimported v1 component/hook files. v2 entry files must pass without warnings or errors.