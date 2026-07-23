# GSPlay v2 home-server cutover runbook

This is the production procedure for the Arch Linux host: checkout at `~/s/gsplay`, staged runtime at `/srv/gsplay`, Caddy at `gsplay.daje.cc`, systemd, and bare-metal MongoDB.

> **Safety boundary:** v1 collections (`users`, `games`, and related legacy collections) are never renamed, altered, or deleted. v2 uses `*_v2` collections, so rollback is a traffic/service decision rather than a reverse migration.

## Recorded automated evidence

- `npm run test:v2`: 15 suites / 83 tests passed after adding migration coverage.
- `cd gsplay-frontend && npm run lint && npm run build`: passed.
- `cd gsplay-frontend && npm run test:e2e`: 30 Playwright checks passed at 360, 390, 768, 900, 1280, and 1440 px.

These checks do not replace the backup, real-provider smoke test, or live health check below.

## One-time server preparation

```bash
sudo useradd --system --home /srv/gsplay --shell /usr/bin/nologin gsplay
sudo install -d -o gsplay -g gsplay /srv/gsplay
sudo install -d -m 0750 /etc/gsplay
sudoedit /etc/gsplay/v2.env
sudo chmod 640 /etc/gsplay/v2.env
```

The root-owned environment file must include at minimum:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
PUBLIC_APP_URL=https://gsplay.daje.cc
CORS_ORIGINS=https://gsplay.daje.cc
MONGO_URI=mongodb://127.0.0.1:27017/gsplay
JWT_ACCESS_SECRET=<openssl rand -hex 48>
JWT_REFRESH_SECRET=<different openssl rand -hex 48>
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=20
ENABLE_WORKER=true
IGDB_RECOVER_LEGACY_PERMANENT=false
```

Add provider keys only where desired; never commit this file. Install the checked-in templates after pulling `master`:

```bash
cd ~/s/gsplay
sudo cp deploy/systemd/gsplay-v2-*.service /etc/systemd/system/
sudo cp deploy/Caddyfile.gsplay /etc/caddy/conf.d/gsplay.caddy
sudo systemctl daemon-reload
sudo systemctl enable gsplay-v2-api.service gsplay-v2-worker.service
sudo caddy validate --config /etc/caddy/Caddyfile
```

Ensure the main Caddyfile imports `/etc/caddy/conf.d/*.caddy` if it does not already.

## Backup before migration

```bash
stamp=$(date +%Y%m%d-%H%M%S)
mkdir -p ~/gsplay-backups
set -a; source /etc/gsplay/v2.env; set +a
mongodump --uri "$MONGO_URI" --archive="$HOME/gsplay-backups/gsplay-$stamp.archive.gz" --gzip
gzip -t "$HOME/gsplay-backups/gsplay-$stamp.archive.gz"
```

## v1 → v2 migration

The migration is dry-run-first and idempotent. It preserves user IDs and bcrypt password hashes, maps admins/Steam/Retro fields, seeds canonical games from legacy games, and turns embedded legacy user games into authoritative v2 entitlements.

```bash
cd ~/s/gsplay
git pull --ff-only origin master
set -a; source /etc/gsplay/v2.env; set +a
npm ci
npm run migrate:v1-to-v2
```

The JSON report must contain `"ready": true` and no blockers. If it does not, stop and preserve the report. Do not edit v2 collections to bypass it.

```bash
npm run migrate:v1-to-v2 -- --apply --confirm-migrate-v1-to-v2
npm run bootstrap
npm run migrate:v1-to-v2 -- --verify
```

Invalid title/platform entries are warnings and are skipped. Normalized duplicate usernames and missing password hashes are blockers. Legacy records sharing an IGDB ID are collapsed deterministically into one canonical game and reported as a compact warning.

## Deploy and cut over

The deployment script runs in the checkout, installs/builds there, stages runtime-only files, then publishes to `/srv/gsplay`. It never syncs `.env`, `.git`, or production secrets: systemd and index bootstrap load `/etc/gsplay/v2.env` directly.

```bash
cd ~/s/gsplay
bash ./scripts/deploy-v2.sh
sudo systemctl --no-pager --full status gsplay-v2-api gsplay-v2-worker
curl --fail http://127.0.0.1:3000/health/live
curl --fail http://127.0.0.1:3000/health/ready
```

Before public Caddy cutover, directly smoke-test a migrated login, admin login, library, catalogue, comparison, manual ownership, and one provider/upload job where credentials exist. Then validate/reload Caddy and test `https://gsplay.daje.cc` in a private browser window:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -fu gsplay-v2-api -u gsplay-v2-worker
```

## Rollback procedure

1. Freeze v2 admin mutations/import submissions and preserve the reported request/job IDs.
2. Stop the v2 worker, then the API: `sudo systemctl stop gsplay-v2-worker gsplay-v2-api`.
3. Restore the prior Caddy site/runtime target and reload Caddy. Restart legacy only if it was the last approved public runtime.
4. Do not delete v2 collections or logs. The untouched MongoDB archive and `v1-final` tag remain recovery evidence.

## Final cutover follow-up

After cutover, retain the MongoDB archive, watch `journalctl` for API/worker failures, and keep the `v1-final` tag as source reference. Retroclub is intentionally a frontend holding page; its existing APIs/routes remain deferred work.