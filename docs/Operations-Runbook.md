# Giocatori Stanchi stack operations runbook

This runbook operates the current GSPlay API, worker, frontend release, and supporting data services in the Giocatori Stanchi technical stack. The retained `v2` environment, route, collection, and systemd names are compatibility contracts, not source-layout boundaries.

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
DB_BACKUP_ENABLED=true
DB_BACKUP_DIR=/media/backups/gsplay/db
DB_BACKUP_HOUR=4
DB_BACKUP_RETENTION_DAYS=30
GUIDE_UPLOAD_DIR=/var/lib/gsplay/guide
GUIDE_IMAGE_MAX_BYTES=5242880
SERVER_STATUS_INTEGRATION_TOKEN=<independent random token, 32+ characters>
SERVER_STATUS_MAX_BYTES=65536
SERVER_STATUS_RATE_LIMIT_WINDOW_MS=60000
SERVER_STATUS_RATE_LIMIT_MAX=10
SERVER_STATUS_STALE_AFTER_MS=180000
```

Provider credentials are optional and must remain only in this protected file.

### GSbot Discord setup

GSbot uses a normal Discord Application/Bot user and a guild-scoped temporary `/test` command. It needs only these bootstrap values:

```env
GSBOT_TOKEN=<Discord bot token>
GSBOT_GUILD_ID=<Discord server ID>
```

Create and invite it with the minimum MVP access:

1. Open the [Discord Developer Portal](https://discord.com/developers/applications), select **New Application**, and name it `GSbot`.
2. Open **Bot**. Use **Reset Token** if necessary, copy the bot token, and store it as `GSBOT_TOKEN`. The token is shown only when created or reset; do not use the application ID, public key, or client secret in its place.
3. Leave privileged Gateway intents disabled. GSbot requests only the non-privileged Guilds intent.
4. In the Discord desktop/web client, enable **User Settings → Advanced → Developer Mode**. Right-click the Giocatori Stanchi server, choose **Copy Server ID**, and store that numeric value as `GSBOT_GUILD_ID`.
5. In the Developer Portal, open **OAuth2 → URL Generator**. Select the `bot` and `applications.commands` scopes, select no Bot Permissions, open the generated URL, and add GSbot to the intended server.
6. Add both values to `/etc/gsplay/v2.env`, deploy, and verify `/test` in that server. Its reply is ephemeral and visible only to the invoking member.

Both values absent means the deployment explicitly disables `gsplay-gsbot.service`. Supplying only one makes deployment fail before publishing. Direct `npm run gsbot` startup also fails clearly when either value is missing. No Discord token is stored in MongoDB or exposed to the frontend.

For local verification, put the same two values in the untracked `.env` and run:

```bash
npm run dev:gsbot
```

Successful startup logs `GSbot ready` after the guild command is registered. Stop it with `Ctrl+C`; the runtime closes the Discord client cleanly. The `/test` command is temporary diagnostic functionality and performs no database writes.

`TMDB_READ_ACCESS_TOKEN` enables movie search and insertion in Casual Friday Tools. Existing
playlists, game management, and stored movie snapshots continue to work if TMDB is unavailable.
Set it in the protected environment file using the API Read Access Token from your TMDB account.

Casual Friday movie support reuses `casual_friday_playlist_entries_v2`. On deployment, the standard
bootstrap marks legacy entries as games and replaces their uniqueness index with a compatible
partial index; it creates no new collection and removes no playlist history.

`SERVER_STATUS_STALE_AFTER_MS` controls when the Servers page warns that its latest snapshot is no
longer current. The default is three minutes, comfortably above the 30-second n8n update cycle.

The Casual Friday proposal feature adds `casual_friday_game_proposals_v2`; the standard deployment
bootstrap creates its unique game index. It requires no additional environment settings.

The RSVP and voting lifecycle adds `casual_friday_events_v2` and
`casual_friday_responses_v2`, plus the `votingEnabled` field on existing rotation games. The
standard deployment bootstrap creates their indexes. Existing rotation documents remain compatible
and are voting-enabled unless explicitly disabled; no data migration or new environment setting is
required.

Retroclub monthly scoring adds `retro_challenge_progress_v2`, new lifecycle fields and indexes on
the existing `retro_challenges_v2` collection, and a unique linked RetroAchievements account index
on `users_v2`. The standard deployment bootstrap removes the obsolete unique game index, backfills
legacy challenge lifecycle dates without deleting them, and creates the new indexes. Back up MongoDB
before the first deployment. Configure `RETROACHIEVEMENT_USERNAME` and
`RETROACHIEVEMENT_API_KEY` to enable account verification and worker refreshes;
`RETROACHIEVEMENT_REFRESH_MS` is optional and defaults to 300000. No Caddy route or persistent file
storage change is required.

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

### Scheduled database backups

The worker can create one compressed MongoDB archive per day. Before enabling it, install the
MongoDB Database Tools so `mongodump` is available to the `gsplay` service, verify that the NAS is
mounted, and prepare the configured directory:

```bash
sudo mkdir -p /media/backups/gsplay/db
sudo chown gsplay:gsplay /media/backups/gsplay/db
sudo chmod 750 /media/backups/gsplay/db
sudo -u gsplay test -r /media/backups/gsplay/db
sudo -u gsplay test -w /media/backups/gsplay/db
```

Parent directories must also grant the `gsplay` user traversal permission. If that needs an ACL on
the host, configure it there rather than in the application or deploy script. The supplied worker
unit allows the standard backup directory through its filesystem sandbox. A custom
`DB_BACKUP_DIR` also requires a matching `ReadWritePaths` systemd override.

Set `DB_BACKUP_ENABLED=true`, `DB_BACKUP_DIR=/media/backups/gsplay/db`, the desired local
`DB_BACKUP_HOUR`, and `DB_BACKUP_RETENTION_DAYS` in `/etc/gsplay/v2.env`. Scheduling follows
Europe/Rome time. A missing directory, unavailable mount, missing `mongodump`, or failed dump is
logged without stopping the worker. Retention runs only after a new archive succeeds.

For an urgent diagnostic or pre-change backup, invoke the same operation manually. It will not
overwrite an archive already completed for the current date:

```bash
sudo -u gsplay bash -c 'set -a; source /etc/gsplay/v2.env; set +a; exec node /srv/gsplay/scripts/backup-db.js'
```

These scheduled archives contain MongoDB only. Guide uploads remain a separate filesystem backup.

## Routine deployment

Merge tested work to `master`, then run on the server:

```bash
cd ~/s/gsplay
git pull --ff-only origin master
./scripts/deploy.sh
```

Tests, lint, and dependency audits are completed before merging; deployment does not repeat them or install backend development dependencies.

`deploy.sh` refuses dirty or out-of-sync source, installs frontend build dependencies and builds the production bundle, prepares backend production dependencies and database indexes before publication, installs current systemd unit definitions, publishes to `/srv/gsplay`, restarts API and worker plus configured GSbot, and waits for runtime checks. It also verifies that the installed bcrypt native module loads before publication.

Successful steps print a concise summary; a failed step prints its captured command output automatically. Use `DEPLOY_VERBOSE=true ./scripts/deploy.sh` to print command output after every preparation step.

Check the running release and services:

```bash
cat /srv/gsplay/REVISION
sudo systemctl --no-pager --full status gsplay-v2-api.service gsplay-v2-worker.service gsplay-gsbot.service
curl --fail http://127.0.0.1:3000/health/live
curl --fail http://127.0.0.1:3000/health/ready
```

## Backup and recovery

The scheduled database backup above is the normal MongoDB protection. For a separate timestamped
database archive or a matching guide-image backup before unusual manual work:

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
sudo journalctl -u gsplay-v2-api.service -u gsplay-v2-worker.service -u gsplay-gsbot.service -n 100 --no-pager
sudo journalctl -fu gsplay-v2-api.service -u gsplay-v2-worker.service -u gsplay-gsbot.service
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
