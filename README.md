# Giocatori Stanchi technical stack

This repository contains the technical stack for the Giocatori Stanchi community. It is intentionally a monorepo for community-owned runtimes, integrations, operational tooling, and shared capabilities. GSPlay, the current self-hosted web application, is a major component rather than the repository boundary.

## Current components

- Express API, durable background worker, and GSbot Discord runtime with a runtime-neutral shared core.
- Cookie-based access/refresh sessions, role-based admin access, and narrow auth rate limiting.
- Authoritative `LibraryItem` entitlements, Steam sync, strict CSV/JSON imports, and durable retryable jobs.
- Server-side library comparison; complete user libraries are never aggregated in the browser.
- Canonical catalogue, official IGDB enrichment jobs, ambiguity review, merge stewardship, and manual ownership.
- Responsive React/MUI interface with Home, Library, Compare, Catalogue, Game Detail, and Admin workflows.
- Playful Roman-flavoured member copy, with deliberately direct admin and helper tooling.
- Isolated MongoMemoryServer backend tests and responsive Playwright release smoke checks.

## Local development

Prerequisites: Node.js 18 or newer, npm, and MongoDB. Copy `.env.example` to `.env`, create two independent 32+-character JWT secrets, and keep `.env` untracked.

```bash
npm ci
npm run bootstrap
npm run dev
```

`npm run dev` starts the API, durable worker, and Vite frontend together. Output is prefixed with `[api]`, `[worker]`, or `[web]`; press `Ctrl+C` once to stop the entire stack cleanly. The API watches `src/api` and `src/core`, while the worker watches `src/worker` and `src/core`; Vite provides frontend HMR. The runner uses the expected `http://localhost:5173`; if Vite reports another port, stop old development stacks before continuing.

The frontend opens on `http://localhost:5173` and proxies `/api` to the API at `http://localhost:3000`. Public routes retain the compatible `/api/v2` prefix.

GSbot is intentionally started separately so missing Discord credentials do not block normal web development. Set `GSBOT_TOKEN` and `GSBOT_GUILD_ID`, then run `npm run dev:gsbot` for reload support or `npm run gsbot` directly.

See [Architecture](docs/Architecture.md) for source ownership and dependency rules.

## Quality checks

```bash
npm test

cd gsplay-frontend
npm run lint
npm run build
npm run test:e2e
```

The end-to-end suite runs an isolated in-memory MongoDB, API, and Vite server. It does not access your `.env`, local database, or provider credentials.

## Production deployment

Production uses a root-owned `/etc/gsplay/v2.env`, independent systemd services, and Caddy as the TLS frontend. After merging a tested change to `master`, deploy from the server checkout:

```bash
cd ~/s/gsplay
git pull --ff-only origin master
./scripts/deploy.sh
```

The deploy script requires a clean checkout synchronized with `origin/master`, builds the frontend, prepares and validates a runtime release, verifies indexes, publishes to `/srv/gsplay`, restarts configured runtimes, and waits for their checks. Tests, lint, and dependency audits are intentionally completed before merge rather than repeated during deployment.

See [Operations Runbook](docs/Operations-Runbook.md) for setup, backup, deployment, rollback, and incident procedures.

## Useful scripts

| Command                | Purpose                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `npm start`            | Start the API                                                  |
| `npm run dev`          | Start API, worker, and frontend together with hot reload       |
| `npm run dev:api`      | Start only the API with nodemon                                |
| `npm run dev:worker`   | Start only the worker with nodemon                             |
| `npm run dev:gsbot`    | Start only GSbot with nodemon                                  |
| `npm run dev:frontend` | Start only the Vite frontend                                   |
| `npm run worker`       | Start the durable worker                                       |
| `npm run gsbot`        | Start the GSbot Discord runtime                                |
| `npm run bootstrap`    | Create/verify indexes                                          |
| `npm run format`       | Format backend, frontend, tests, and project files             |
| `npm run format:check` | Verify repository formatting without changing files            |
| `npm run lint`         | Lint backend and frontend JavaScript                           |
| `./scripts/deploy.sh`  | Build, validate, publish, restart, and health-check production |
| `npm test`             | Run backend tests                                              |

## Security notes

- Keep MongoDB and Node bound to loopback; Caddy is the public TLS endpoint.
- Store production secrets in `/etc/gsplay/v2.env`, never in Git or frontend environment variables.
- Use independent high-entropy access and refresh JWT secrets.
- Preserve a `mongodump` archive before any production data/schema operation.

## Historical source

GSPlay now runs solely on the current architecture. The former implementation and one-time migration tooling are retained only in Git history: `v1-final`, `legacy-v1`, and `migration-v1-to-v2-final`.
