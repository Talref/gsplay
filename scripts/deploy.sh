#!/usr/bin/env bash
set -Eeuo pipefail

# Run from the checked-out production branch after: git pull --ff-only origin master
# Tests, lint, and dependency audits are completed before merging.
SOURCE_ROOT="${SOURCE_ROOT:-$PWD}"
DESTINATION="${DESTINATION:-/srv/gsplay}"
ENV_FILE="${ENV_FILE:-/etc/gsplay/v2.env}"
API_SERVICE="${API_SERVICE:-gsplay-v2-api.service}"
WORKER_SERVICE="${WORKER_SERVICE:-gsplay-v2-worker.service}"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/gsplay-release.XXXXXX")"
LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gsplay-deploy-logs.XXXXXX")"
DEPLOY_VERBOSE="${DEPLOY_VERBOSE:-false}"

cleanup() { rm -rf "$STAGE" "$LOG_DIR"; }
trap cleanup EXIT
fail() { echo "❌ $*" >&2; exit 1; }
require() { command -v "$1" >/dev/null || fail "Missing required command: $1"; }
run_quiet() {
  local description="$1" log="$2"
  shift 2
  if "$@" >"$log" 2>&1; then
    [[ "$DEPLOY_VERBOSE" == 'true' ]] && cat "$log"
    return 0
  fi
  cat "$log" >&2
  fail "$description failed"
}

[[ -f "$SOURCE_ROOT/package-lock.json" && -f "$SOURCE_ROOT/gsplay-frontend/package-lock.json" ]] || fail "Run from the GSPlay checkout root"
[[ -f "$ENV_FILE" ]] || fail "Missing production environment file: $ENV_FILE"
require node; require npm; require rsync; require curl; require sudo; require systemctl
cd "$SOURCE_ROOT"
[[ -z "$(git status --porcelain)" ]] || fail "Checkout is not clean; commit/stash changes before deployment"
if [[ "${ALLOW_DETACHED_RELEASE:-false}" != 'true' ]]; then
  [[ "$(git branch --show-current)" == "master" ]] || fail "Deployment requires master; use ALLOW_DETACHED_RELEASE=true only for a known-good release tag rollback"
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse @{u})" ]] || fail "Checkout is not synchronized with its upstream; pull or push before deployment"
fi

revision="$(git rev-parse HEAD)"
started_at=$SECONDS
npm_flags=(--no-audit --fund=false --loglevel=error)

echo '▶ Building frontend'
run_quiet 'Frontend dependency installation' "$LOG_DIR/frontend-install.log" npm --prefix "$SOURCE_ROOT/gsplay-frontend" ci --include=dev "${npm_flags[@]}"
run_quiet 'Frontend production build' "$LOG_DIR/frontend-build.log" npm --prefix "$SOURCE_ROOT/gsplay-frontend" run build
echo '✓ Production bundle built'
main_js_gzip="$(sed -nE 's/.*dist\/assets\/index-[^ ]+\.js.*gzip:[[:space:]]*([0-9.]+) kB.*/\1/p' "$LOG_DIR/frontend-build.log" | tail -1)"
main_css_gzip="$(sed -nE 's/.*dist\/assets\/index-[^ ]+\.css.*gzip:[[:space:]]*([0-9.]+) kB.*/\1/p' "$LOG_DIR/frontend-build.log" | tail -1)"
[[ -n "$main_js_gzip" ]] && printf '  Main JavaScript: %s kB gzip\n' "$main_js_gzip"
[[ -n "$main_css_gzip" ]] && printf '  Main CSS:        %s kB gzip\n' "$main_css_gzip"

echo
echo '▶ Preparing runtime'
mkdir -p "$STAGE/gsplay-frontend"
rsync -a --delete --exclude '.env' --exclude '.git' --exclude 'node_modules' --exclude 'tests' --exclude 'docs' --exclude 'coverage' --exclude 'gsplay-frontend' "$SOURCE_ROOT/" "$STAGE/"
rsync -a --delete "$SOURCE_ROOT/gsplay-frontend/dist/" "$STAGE/gsplay-frontend/dist/"
run_quiet 'Runtime dependency installation' "$LOG_DIR/runtime-install.log" npm --prefix "$STAGE" ci --omit=dev "${npm_flags[@]}"
echo '✓ Production dependencies installed'
run_quiet 'bcrypt runtime verification' "$LOG_DIR/bcrypt.log" node -e "require('$STAGE/node_modules/bcrypt')"
echo '✓ bcrypt native module verified'
printf '%s\n' "$revision" > "$STAGE/REVISION"

echo
echo '▶ Preparing database'
sudo -v
run_quiet 'Database index preparation' "$LOG_DIR/bootstrap.log" sudo bash -c 'set -a; source "$1"; set +a; exec npm --prefix "$2" run bootstrap' bash "$ENV_FILE" "$STAGE"
echo '✓ Indexes verified'

echo
echo '▶ Publishing release'
sudo install -m 0644 "$SOURCE_ROOT/deploy/systemd/gsplay-v2-api.service" "/etc/systemd/system/$API_SERVICE"
sudo install -m 0644 "$SOURCE_ROOT/deploy/systemd/gsplay-v2-worker.service" "/etc/systemd/system/$WORKER_SERVICE"
sudo systemctl daemon-reload
sudo install -d -m 0755 "$DESTINATION"
sudo rsync -a --delete --exclude '.env' "$STAGE/" "$DESTINATION/"
sudo systemctl restart "$API_SERVICE" "$WORKER_SERVICE"

for attempt in {1..20}; do
  if curl --fail --silent --max-time 2 http://127.0.0.1:3000/health/live >/dev/null \
    && curl --fail --silent --max-time 2 http://127.0.0.1:3000/health/ready >/dev/null \
    && systemctl is-active --quiet "$API_SERVICE" \
    && systemctl is-active --quiet "$WORKER_SERVICE"; then
    echo '✓ API ready'
    echo '✓ Worker active'
    elapsed=$((SECONDS - started_at))
    echo
    echo '✅ GSPlay deployed successfully'
    echo "   Release: $revision"
    printf '   Duration: %dm %02ds\n' "$((elapsed / 60))" "$((elapsed % 60))"
    exit 0
  fi
  sleep 1
done
sudo systemctl --no-pager --full status "$API_SERVICE" "$WORKER_SERVICE" || true
fail 'Readiness did not recover; inspect journalctl before deploying another revision'
