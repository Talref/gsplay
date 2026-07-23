# GSPlay

GSPlay is a self-hosted shared PC-game library: members can sync Steam ownership, import supported library exports, discover a canonical catalogue, compare shared games server-side, and maintain catalogue metadata through controlled admin workflows.

## What is included

- Cookie-based access/refresh sessions, role-based admin access, and narrow auth rate limiting.
- Authoritative `LibraryItem` entitlements, Steam sync, strict CSV/JSON imports, and durable retryable jobs.
- Server-side library comparison; complete user libraries are never aggregated in the browser.
- Canonical catalogue, official IGDB enrichment jobs, ambiguity review, merge stewardship, and manual ownership.
- Responsive React/MUI interface with Home, Library, Compare, Catalogue, Game Detail, and Admin workflows.
- Isolated MongoMemoryServer backend tests and responsive Playwright release smoke checks.

## Local development

Prerequisites: Node.js, npm, and MongoDB. Copy `.env.example` to `.env`, create two independent 32+-character JWT secrets, and keep `.env` untracked.

```bash
npm ci
npm run bootstrap
npm run dev

# second terminal
npm run worker

# third terminal
cd gsplay-frontend
npm ci
npm run dev
```

The frontend opens on `http://localhost:5173` and proxies `/api` to the v2 API at `http://localhost:3000`.

## Quality checks

```bash
npm test

cd gsplay-frontend
npm run lint
npm run build
npm run test:e2e
```

The end-to-end suite runs an isolated in-memory MongoDB, v2 API, and Vite server. It does not access your `.env`, local database, or provider credentials.

## Production deployment

Production uses a root-owned `/etc/gsplay/v2.env`, systemd API and worker services bound to loopback, and Caddy as the TLS frontend. After merging a tested change to `master`, deploy from the server checkout:

```bash
cd ~/s/gsplay
git pull --ff-only origin master
./scripts/deploy.sh
```

The deploy script requires a clean checkout synchronized with `origin/master`, runs backend tests plus frontend lint/build, prepares and validates a runtime release, verifies indexes, publishes to `/srv/gsplay`, restarts API/worker, and waits for local liveness/readiness checks.

See [Operations Runbook](docs/Operations-Runbook.md) for setup, backup, deployment, rollback, and incident procedures.

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Start the API |
| `npm run dev` | Start the API with nodemon |
| `npm run worker` | Start the durable worker |
| `npm run bootstrap` | Create/verify indexes |
| `./scripts/deploy.sh` | Build, validate, publish, restart, and health-check production |
| `npm test` | Run v2 backend tests |

## Security notes

- Keep MongoDB and Node bound to loopback; Caddy is the public TLS endpoint.
- Store production secrets in `/etc/gsplay/v2.env`, never in Git or frontend environment variables.
- Use independent high-entropy access and refresh JWT secrets.
- Preserve a `mongodump` archive before any production data/schema operation.

## Historical source

GSPlay now runs solely on the current architecture. The former implementation and one-time migration tooling are retained only in Git history: `v1-final`, `legacy-v1`, and `migration-v1-to-v2-final`.