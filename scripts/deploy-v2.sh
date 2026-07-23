#!/usr/bin/env bash
set -Eeuo pipefail

# Run on the home server from ~/s/gsplay after `git pull --ff-only origin master`.
# Build in the checkout; publish only a prepared runtime tree to /srv/gsplay.
SOURCE_ROOT="${SOURCE_ROOT:-$PWD}"
DESTINATION="${DESTINATION:-/srv/gsplay}"
ENV_FILE="${ENV_FILE:-/etc/gsplay/v2.env}"
API_SERVICE="${API_SERVICE:-gsplay-v2-api.service}"
WORKER_SERVICE="${WORKER_SERVICE:-gsplay-v2-worker.service}"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/gsplay-release.XXXXXX")"

cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT
fail() { echo "❌ $*" >&2; exit 1; }
require() { command -v "$1" >/dev/null || fail "Missing required command: $1"; }

[[ -f "$SOURCE_ROOT/package-lock.json" && -f "$SOURCE_ROOT/gsplay-frontend/package-lock.json" ]] || fail "Run from the GSPlay checkout root"
[[ -f "$ENV_FILE" ]] || fail "Missing production environment file: $ENV_FILE"
require npm; require rsync; require curl; require sudo; require systemctl
cd "$SOURCE_ROOT"
[[ -z "$(git status --porcelain)" ]] || fail "Checkout is not clean; commit/stash changes before deployment"
[[ "$(git branch --show-current)" == "master" ]] || fail "Deployment requires the master branch"

echo '▶ Installing locked backend dependencies in the checkout'
npm ci --omit=dev
echo '▶ Building locked frontend release in the checkout'
(cd gsplay-frontend && npm ci --include=dev && npm run lint && npm run build)
echo '▶ Preparing runtime-only staged release'
mkdir -p "$STAGE/gsplay-frontend"
rsync -a --delete --exclude '.env' --exclude '.git' --exclude 'node_modules' --exclude 'tests' --exclude 'docs' --exclude 'coverage' --exclude 'gsplay-frontend' "$SOURCE_ROOT/" "$STAGE/"
rsync -a --delete "$SOURCE_ROOT/gsplay-frontend/dist/" "$STAGE/gsplay-frontend/dist/"

echo "▶ Publishing prepared release to $DESTINATION"
sudo install -d -m 0755 "$DESTINATION"
sudo rsync -a --delete --exclude '.env' "$STAGE/" "$DESTINATION/"
sudo npm --prefix "$DESTINATION" ci --omit=dev
echo '▶ Verifying v2 indexes and restarting services'
sudo bash -c 'set -a; source "$1"; set +a; exec npm --prefix "$2" run bootstrap' bash "$ENV_FILE" "$DESTINATION"
sudo systemctl restart "$API_SERVICE" "$WORKER_SERVICE"

for attempt in {1..20}; do
  if curl --fail --silent --show-error http://127.0.0.1:3000/health/live >/dev/null && curl --fail --silent --show-error http://127.0.0.1:3000/health/ready >/dev/null; then
    echo "✅ GSPlay v2 deployed and ready from $(git rev-parse --short HEAD)"
    exit 0
  fi
  sleep 1
done
sudo systemctl --no-pager --full status "$API_SERVICE" || true
fail 'v2 readiness did not recover; inspect journalctl and roll back Caddy/service target if necessary'