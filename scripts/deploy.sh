#!/usr/bin/env bash
set -Eeuo pipefail

# Run from the checked-out production branch after: git pull --ff-only origin master
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
audit_counts() {
  node -e "const fs=require('fs'); const report=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); const counts=report.metadata?.vulnerabilities; if (!counts) process.exit(1); console.log(counts.total, counts.high, counts.critical);" "$1"
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

echo '▶ Running backend tests'
run_quiet 'Backend dependency installation' "$LOG_DIR/backend-install.log" npm ci "${npm_flags[@]}"
run_quiet 'Backend tests' "$LOG_DIR/backend-tests.log" env MONGO_URI='mongodb://127.0.0.1:27017/gsplay-test-preflight' npm test
suite_count="$(sed -nE 's/^Test Suites: ([0-9]+) passed,.*$/\1/p' "$LOG_DIR/backend-tests.log" | tail -1)"
test_count="$(sed -nE 's/^Tests:[[:space:]]+([0-9]+) passed,.*$/\1/p' "$LOG_DIR/backend-tests.log" | tail -1)"
if [[ -n "$suite_count" && -n "$test_count" ]]; then
  echo "✓ $suite_count suites and $test_count tests passed"
else
  echo '✓ Backend tests passed'
fi

echo
echo '▶ Building frontend'
run_quiet 'Frontend dependency installation' "$LOG_DIR/frontend-install.log" npm --prefix "$SOURCE_ROOT/gsplay-frontend" ci --include=dev "${npm_flags[@]}"
run_quiet 'Frontend lint' "$LOG_DIR/frontend-lint.log" npm --prefix "$SOURCE_ROOT/gsplay-frontend" run lint
echo '✓ Lint passed'
run_quiet 'Frontend production build' "$LOG_DIR/frontend-build.log" npm --prefix "$SOURCE_ROOT/gsplay-frontend" run build
echo '✓ Production bundle built'
main_js_gzip="$(sed -nE 's/.*dist\/assets\/index-[^ ]+\.js.*gzip:[[:space:]]*([0-9.]+) kB.*/\1/p' "$LOG_DIR/frontend-build.log" | tail -1)"
main_css_gzip="$(sed -nE 's/.*dist\/assets\/index-[^ ]+\.css.*gzip:[[:space:]]*([0-9.]+) kB.*/\1/p' "$LOG_DIR/frontend-build.log" | tail -1)"
[[ -n "$main_js_gzip" ]] && printf '  Main JavaScript: %s kB gzip\n' "$main_js_gzip"
[[ -n "$main_css_gzip" ]] && printf '  Main CSS:        %s kB gzip\n' "$main_css_gzip"

echo
echo '▶ Auditing dependencies'
npm audit --omit=dev --json --loglevel=error >"$LOG_DIR/backend-audit-production.json" 2>&1 || true
npm --prefix "$SOURCE_ROOT/gsplay-frontend" audit --omit=dev --json --loglevel=error >"$LOG_DIR/frontend-audit-production.json" 2>&1 || true
npm audit --json --loglevel=error >"$LOG_DIR/backend-audit-all.json" 2>&1 || true
npm --prefix "$SOURCE_ROOT/gsplay-frontend" audit --json --loglevel=error >"$LOG_DIR/frontend-audit-all.json" 2>&1 || true
read -r backend_prod_total backend_prod_high backend_prod_critical < <(audit_counts "$LOG_DIR/backend-audit-production.json") || { cat "$LOG_DIR/backend-audit-production.json" >&2; fail 'Backend production audit could not be completed'; }
read -r frontend_prod_total frontend_prod_high frontend_prod_critical < <(audit_counts "$LOG_DIR/frontend-audit-production.json") || { cat "$LOG_DIR/frontend-audit-production.json" >&2; fail 'Frontend production audit could not be completed'; }
read -r backend_all_total _backend_all_high _backend_all_critical < <(audit_counts "$LOG_DIR/backend-audit-all.json") || { cat "$LOG_DIR/backend-audit-all.json" >&2; fail 'Backend development audit could not be completed'; }
read -r frontend_all_total _frontend_all_high _frontend_all_critical < <(audit_counts "$LOG_DIR/frontend-audit-all.json") || { cat "$LOG_DIR/frontend-audit-all.json" >&2; fail 'Frontend development audit could not be completed'; }
if (( backend_prod_high + backend_prod_critical > 0 )); then
  cat "$LOG_DIR/backend-audit-production.json" >&2
  fail 'Backend production dependencies contain high or critical vulnerabilities'
fi
if (( frontend_prod_high + frontend_prod_critical > 0 )); then
  cat "$LOG_DIR/frontend-audit-production.json" >&2
  fail 'Frontend production dependencies contain high or critical vulnerabilities'
fi
development_findings=$((backend_all_total + frontend_all_total - backend_prod_total - frontend_prod_total))
if (( development_findings < 0 )); then development_findings=0; fi
if (( development_findings > 0 )); then
  echo '⚠ Development tooling contains known advisories (not in runtime release)'
else
  echo '✓ Development tooling has no known vulnerabilities'
fi
if (( backend_prod_total > 0 )); then echo "⚠ Backend production dependencies contain $backend_prod_total low/moderate finding(s)"; else echo '✓ Backend production dependencies clean'; fi
if (( frontend_prod_total > 0 )); then echo "⚠ Frontend production dependencies contain $frontend_prod_total low/moderate finding(s)"; else echo '✓ Frontend production dependencies clean'; fi

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
