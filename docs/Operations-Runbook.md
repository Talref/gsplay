# GSPlay operations runbook

This guide covers the ongoing Arch Linux production setup: checkout at `~/s/gsplay`, runtime at `/srv/gsplay`, Caddy at `gsplay.daje.cc`, systemd services, and MongoDB.

## One-time host setup

```bash
sudo useradd --system --home /srv/gsplay --shell /usr/bin/nologin gsplay
sudo install -d -o gsplay -g gsplay /srv/gsplay
sudo install -d -m 0750 /etc/gsplay
sudoedit /etc/gsplay/v2.env
sudo chown root:gsplay /etc/gsplay/v2.env
sudo chmod 640 /etc/gsplay/v2.env
```

At minimum, `/etc/gsplay/v2.env` needs:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
PUBLIC_APP_URL=https://gsplay.daje.cc
CORS_ORIGINS=https://gsplay.daje.cc
MONGO_URI=<authenticated MongoDB URI>
JWT_ACCESS_SECRET=<independent random secret, 32+ characters>
JWT_REFRESH_SECRET=<different random secret, 32+ characters>
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=20
ENABLE_WORKER=true
```

Provider credentials are optional and must remain only in this protected file.

Initial Caddy routing should proxy the API namespace and serve the built SPA:

```caddy
gsplay.daje.cc {
    encode zstd gzip

    handle /api/v2/* {
        reverse_proxy 127.0.0.1:3000
    }

    handle {
        root * /srv/gsplay/gsplay-frontend/dist
        try_files {path} /index.html
        file_server
    }
}
```

## Routine deployment

Merge tested work to `master`, then run on the server:

```bash
cd ~/s/gsplay
git pull --ff-only origin master
./scripts/deploy.sh
```

`deploy.sh` refuses dirty or out-of-sync source, runs backend tests and frontend lint/build, prepares dependencies and index checks before publication, installs current systemd unit definitions, publishes to `/srv/gsplay`, restarts both services, and waits for local liveness/readiness.

Check the running release and services:

```bash
cat /srv/gsplay/REVISION
sudo systemctl --no-pager --full status gsplay-v2-api.service gsplay-v2-worker.service
curl --fail http://127.0.0.1:3000/health/live
curl --fail http://127.0.0.1:3000/health/ready
```

## Backup and recovery

Before data changes, upgrades that change schemas, or manual MongoDB work:

```bash
stamp=$(date +%Y%m%d-%H%M%S)
mkdir -p ~/gsplay-backups
sudo bash -c 'set -a; source /etc/gsplay/v2.env; set +a; mongodump --uri "$MONGO_URI" --archive="$1" --gzip' bash "$HOME/gsplay-backups/gsplay-$stamp.archive.gz"
gzip -t "$HOME/gsplay-backups/gsplay-$stamp.archive.gz"
```

For an application rollback, deploy a previously known-good release tag rather than modifying database collections:

```bash
cd ~/s/gsplay
git fetch --tags origin
git switch --detach <known-good-tag>
ALLOW_DETACHED_RELEASE=true ./scripts/deploy.sh
```

After recovery, return the checkout to `master` deliberately. Database restores should be a separate, reviewed incident operation using a tested archive.

## Diagnostics

```bash
sudo journalctl -u gsplay-v2-api.service -u gsplay-v2-worker.service -n 100 --no-pager
sudo journalctl -fu gsplay-v2-api.service -u gsplay-v2-worker.service
sudo caddy validate --config /etc/caddy/Caddyfile
```

The public Caddy boundary intentionally proxies only `/api/v2/*`. Local `/health/*` endpoints are for systemd/host checks and do not need public routing.

## Branch and release policy

- `master` is always releasable.
- Use short-lived `feat/*` and `fix/*` branches; merge only after quality checks pass.
- Branch hotfixes from the deployed release tag when `master` contains unreleased work.
- Tag every successful production release (`v2.0.1`, `v2.1.0`, and so on).
- Do not retain a permanent staging branch unless it has its own regularly used environment and database.