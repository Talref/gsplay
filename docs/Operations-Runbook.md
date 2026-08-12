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
GUIDE_UPLOAD_DIR=/var/lib/gsplay/guide
GUIDE_IMAGE_MAX_BYTES=5242880
SERVER_STATUS_INTEGRATION_TOKEN=<independent random token, 32+ characters>
SERVER_STATUS_MAX_BYTES=65536
SERVER_STATUS_RATE_LIMIT_WINDOW_MS=60000
SERVER_STATUS_RATE_LIMIT_MAX=10
SERVER_STATUS_STALE_AFTER_MS=180000
```

Provider credentials are optional and must remain only in this protected file.

`SERVER_STATUS_STALE_AFTER_MS` controls when the Servers page warns that its latest snapshot is no
longer current. The default is three minutes, comfortably above the 30-second n8n update cycle.

The Casual Friday proposal feature adds `casual_friday_game_proposals_v2`; the standard deployment
bootstrap creates its unique game index. It requires no additional environment settings.

The RSVP and voting lifecycle adds `casual_friday_events_v2` and
`casual_friday_responses_v2`, plus the `votingEnabled` field on existing rotation games. The
standard deployment bootstrap creates their indexes. Existing rotation documents remain compatible
and are voting-enabled unless explicitly disabled; no data migration or new environment setting is
required.

Initial Caddy routing should proxy the API namespace, serve immutable frontend files directly, and
send page navigation to the API so it can inject crawler-visible social metadata into the SPA HTML:

```caddy
gsplay.daje.cc {
    encode zstd gzip

    handle /api/v2/* {
        reverse_proxy 127.0.0.1:3000
    }

    handle /uploads/guide/* {
        reverse_proxy 127.0.0.1:3000
    }

    handle /assets/* {
        root * /srv/gsplay/gsplay-frontend/dist
        file_server
    }

    @frontend_public path /8bit.ttf /gslogo.png /placeholder-game.jpg
    handle @frontend_public {
        root * /srv/gsplay/gsplay-frontend/dist
        file_server
    }

    handle {
        reverse_proxy 127.0.0.1:3000
    }
}
```

This Caddy layout is required for social previews. After changing a custom Caddyfile, validate and
reload it using the normal host procedure. Existing API, upload, and asset URLs do not change.

The API systemd unit creates `/var/lib/gsplay` as persistent state owned by the `gsplay` service
account; GSPlay creates its `guide` subdirectory on the first upload. The path is outside
`/srv/gsplay`, so publishing a release does not replace uploaded guide images. If
`GUIDE_UPLOAD_DIR` is customized, add the same absolute path to the API unit's `ReadWritePaths` and
backup commands.

## Routine deployment

Merge tested work to `master`, then run on the server:

```bash
cd ~/s/gsplay
git pull --ff-only origin master
./scripts/deploy.sh
```

`deploy.sh` refuses dirty or out-of-sync source, runs backend tests in an isolated MongoMemoryServer preflight environment and frontend lint/build, prepares dependencies and index checks before publication, installs current systemd unit definitions, publishes to `/srv/gsplay`, restarts both services, and waits for local liveness/readiness.

Successful steps print a concise summary; a failed step prints its captured command output automatically. Use `DEPLOY_VERBOSE=true ./scripts/deploy.sh` to print command output after every validation step.

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
sudo bash -c 'set -a; source "$1"; set +a; tar -C "${GUIDE_UPLOAD_DIR:-/var/lib/gsplay/guide}" -czf "$2" .' bash /etc/gsplay/v2.env "$HOME/gsplay-backups/gsplay-guide-images-$stamp.tar.gz"
gzip -t "$HOME/gsplay-backups/gsplay-guide-images-$stamp.tar.gz"
```

Keep the MongoDB archive and matching guide-image archive together. To restore guide images after
provisioning the API unit, stop the API, extract into the configured empty upload directory, restore
ownership, and start the API again:

```bash
sudo systemctl stop gsplay-v2-api.service
sudo install -d -o gsplay -g gsplay -m 0750 /var/lib/gsplay/guide
sudo tar -xzf ~/gsplay-backups/gsplay-guide-images-<timestamp>.tar.gz -C /var/lib/gsplay/guide
sudo chown -R gsplay:gsplay /var/lib/gsplay/guide
sudo systemctl start gsplay-v2-api.service
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

The public Caddy boundary proxies `/api/v2/*` and immutable `/uploads/guide/*` content. Local
`/health/*` endpoints are for systemd/host checks and do not need public routing.

## Branch and release policy

- `master` is always releasable.
- Use short-lived `feat/*` and `fix/*` branches; merge only after quality checks pass.
- Branch hotfixes from the deployed release tag when `master` contains unreleased work.
- Tag every successful production release (`v2.0.1`, `v2.1.0`, and so on).
- Do not retain a permanent staging branch unless it has its own regularly used environment and database.
