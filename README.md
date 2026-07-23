# GSPlay v2

GSPlay is a self-hosted shared PC-game library: members can sync Steam ownership, import supported library exports, discover a canonical catalogue, compare shared games server-side, and maintain catalogue metadata through controlled admin workflows.

The legacy v1 codebase is intentionally absent from this branch. It is preserved for source reference at the annotated `v1-final` tag and local/remote `legacy-v1` branch.

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

## Migration and production deployment

The v1→v2 migration is dry-run-first and does **not** modify v1 collections:

```bash
npm run migrate:v1-to-v2
npm run migrate:v1-to-v2 -- --apply --confirm-migrate-v1-to-v2
npm run migrate:v1-to-v2 -- --verify
```

For Arch Linux, Caddy, systemd, MongoDB backup, migration, deployment, health-check, and rollback commands, follow the [v2 cutover runbook](docs/V2-Cutover-Runbook.md). The staged deploy script is `scripts/deploy-v2.sh`: it builds in `~/s/gsplay` and publishes the prepared release to `/srv/gsplay` only after successful checks.

For preview-only workflow and supported import contracts, see [V2-Preview.md](docs/V2-Preview.md).

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Start the v2 API |
| `npm run dev` | Start the v2 API with nodemon |
| `npm run worker` | Start the durable v2 worker |
| `npm run bootstrap` | Create/verify v2 indexes only |
| `npm run migrate:v1-to-v2` | Read-only migration report by default |
| `npm test` | Run v2 backend tests |

## Security notes

- Keep MongoDB and Node bound to loopback; Caddy is the public TLS endpoint.
- Store production secrets in `/etc/gsplay/v2.env`, never in Git or frontend environment variables.
- Use independent high-entropy access and refresh JWT secrets.
- Preserve a `mongodump` archive before migration or any production schema operation.