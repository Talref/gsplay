#!/usr/bin/env bash
set -Eeuo pipefail

# Run from the checked-out production branch after: git pull --ff-only origin master
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
if [[ "${ALLOW_DETACHED_RELEASE:-false}" != 'true' ]]; then
  [[ "$(git branch --show-current)" == "master" ]] || fail "Deployment requires master; use ALLOW_DETACHED_RELEASE=true only for a known-good release tag rollback"
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse @{u})" ]] || fail "Checkout is not synchronized with its upstream; pull or push before deployment"
fi

revision="$(git rev-parse HEAD)"
echo '▶ Validating backend'
npm ci
MONGO_URI='mongodb://127.0.0.1:27017/gsplay-test-preflight' npm test
echo '▶ Building frontend release'
(cd gsplay-frontend && npm ci --include=dev && npm run lint && npm run build)
echo '▶ Preparing and validating runtime release'
mkdir -p "$STAGE/gsplay-frontend"
rsync -a --delete --exclude '.env' --exclude '.git' --exclude 'node_modules' --exclude 'tests' --exclude 'docs' --exclude 'coverage' --exclude 'gsplay-frontend' "$SOURCE_ROOT/" "$STAGE/"
rsync -a --delete "$SOURCE_ROOT/gsplay-frontend/dist/" "$STAGE/gsplay-frontend/dist/"
npm --prefix "$STAGE" ci --omit=dev
node -e "require('$STAGE/node_modules/bcrypt'); console.log('bcrypt runtime module OK')"
printf '%s\n' "$revision" > "$STAGE/REVISION"
sudo bash -c 'set -a; source "$1"; set +a; exec npm --prefix "$2" run bootstrap' bash "$ENV_FILE" "$STAGE"

echo '▶ Updating service definitions and publishing release'
sudo install -m 0644 "$SOURCE_ROOT/deploy/systemd/gsplay-v2-api.service" "/etc/systemd/system/$API_SERVICE"
sudo install -m 0644 "$SOURCE_ROOT/deploy/systemd/gsplay-v2-worker.service" "/etc/systemd/system/$WORKER_SERVICE"
sudo systemctl daemon-reload
sudo install -d -m 0755 "$DESTINATION"
sudo rsync -a --delete --exclude '.env' "$STAGE/" "$DESTINATION/"
sudo systemctl restart "$API_SERVICE" "$WORKER_SERVICE"

for attempt in {1..20}; do
  if curl --fail --silent --show-error http://127.0.0.1:3000/health/live >/dev/null && curl --fail --silent --show-error http://127.0.0.1:3000/health/ready >/dev/null; then
    echo "✅ GSPlay deployed and ready from $revision"
    exit 0
  fi
  sleep 1
done
sudo systemctl --no-pager --full status "$API_SERVICE" "$WORKER_SERVICE" || true
fail 'Readiness did not recover; inspect journalctl before deploying another revision'