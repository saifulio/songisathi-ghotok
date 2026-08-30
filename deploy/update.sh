#!/usr/bin/env bash
#
# SongiSathi Ghotok — redeploy an already-configured server.
#
#   sudo bash deploy/update.sh
#
# Pulls, reinstalls dependencies, applies any new tables, rebuilds the
# frontend and restarts the API. Assumes deploy/setup.sh has run once already.
#
# Note that db:migrate only creates tables that are missing; it does not alter
# tables that already exist. A change to a live table still needs SQL by hand.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
conf="$here/deploy.conf"

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run with sudo: sudo bash deploy/update.sh"
[[ -f $conf ]] || die "No deploy/deploy.conf — this server has not been set up."

# shellcheck source=/dev/null
source "$conf"
: "${APP_USER:?}" "${APP_DIR:?}"
API_PORT="${API_PORT:-4000}"

as_app() { sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && $*"; }

if [[ -d $APP_DIR/.git ]]; then
  say "Pulling"
  as_app "git pull --ff-only"
fi

say "Installing dependencies"
as_app "npm ci --no-audit --no-fund"

say "Applying the schema"
as_app "npm run db:migrate"

say "Building"
as_app "npm run build"
chmod -R o+rX "$APP_DIR/dist"

say "Restarting the API"
systemctl restart songisathi-api

for _ in {1..15}; do
  curl -fsS "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1 || {
  journalctl -u songisathi-api -n 30 --no-pager || true
  die "The API did not come back — see the log above."
}

say "Deployed"
