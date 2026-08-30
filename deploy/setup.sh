#!/usr/bin/env bash
#
# SongiSathi Ghotok — first-run setup for a fresh Ubuntu VPS.
#
#   cp deploy/deploy.conf.example deploy/deploy.conf   # then edit it
#   sudo bash deploy/setup.sh
#
# Installs Node, MySQL and Nginx; creates the database user; writes .env;
# installs dependencies; migrates; builds the frontend; and installs the
# systemd unit and the Nginx site.
#
# Safe to re-run: every step checks for what it is about to create, and an
# existing .env is left alone (so JWT_SECRET stays put and sessions survive).
# For routine redeploys use deploy/update.sh instead — it is much quicker.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
conf="$here/deploy.conf"

say()  { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run with sudo: sudo bash deploy/setup.sh"
[[ -f $conf ]] || die "No deploy/deploy.conf — copy deploy/deploy.conf.example and edit it."

# shellcheck source=/dev/null
source "$conf"

: "${APP_USER:?APP_USER is not set in deploy.conf}"
: "${APP_DIR:?APP_DIR is not set in deploy.conf}"
: "${DB_NAME:?}" "${DB_USER:?}" "${DB_PASS:?}"
DOMAIN="${DOMAIN:-_}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
API_PORT="${API_PORT:-4000}"
NODE_MAJOR="${NODE_MAJOR:-24}"
ENABLE_TLS="${ENABLE_TLS:-no}"
ENABLE_UFW="${ENABLE_UFW:-yes}"
SEED_DEMO_DATA="${SEED_DEMO_DATA:-no}"

id -u "$APP_USER" >/dev/null 2>&1 || die "No such user: $APP_USER"
[[ $DB_PASS != "change-this-to-a-strong-password" ]] \
  || die "Set a real DB_PASS in deploy.conf first."

# Run a command as the app user, from the app directory.
as_app() { sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && $*"; }

say "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates mysql-server nginx

# Node from NodeSource, so the version does not depend on the app user's nvm.
# systemd runs /usr/bin/node; an nvm copy in the user's shell is unaffected.
if [[ ! -x /usr/bin/node ]] || [[ $(/usr/bin/node -v) != v${NODE_MAJOR}.* ]]; then
  say "Installing Node ${NODE_MAJOR} system-wide"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi
say "Node: $(/usr/bin/node -v) at /usr/bin/node"

say "Starting MySQL"
systemctl enable --now mysql

# The migration creates the database itself, so this only has to make the user
# and grant it rights over that name.
say "Ensuring database user ${DB_USER}"
mysql --protocol=socket <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

say "Fetching the application"
if [[ ! -d $APP_DIR ]]; then
  [[ -n ${REPO_URL:-} ]] || die "$APP_DIR does not exist and REPO_URL is empty."
  install -d -o "$APP_USER" -g "$APP_USER" "$(dirname "$APP_DIR")"
  sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR"
else
  echo "  using existing checkout at $APP_DIR"
fi
[[ -f $APP_DIR/package.json ]] || die "$APP_DIR does not look like the app (no package.json)."

# Anything created by an earlier root-run command (or an accidental `sudo npm`)
# would otherwise stop the app user from building.
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

if [[ $DOMAIN == "_" ]]; then
  default_url="http://$(hostname -I | awk '{print $1}')"
elif [[ $ENABLE_TLS == "yes" ]]; then
  default_url="https://${DOMAIN}"
else
  default_url="http://${DOMAIN}"
fi
APP_URL="${APP_URL:-$default_url}"

if [[ -f $APP_DIR/.env ]]; then
  say "Keeping the existing .env"
  warn "Check DATABASE_URL and APP_URL in it if you changed deploy.conf."
else
  say "Writing .env"
  secret="${JWT_SECRET:-$(openssl rand -hex 48)}"
  cat > "$APP_DIR/.env" <<ENV
DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
JWT_SECRET="${secret}"
API_PORT=${API_PORT}
APP_URL="${APP_URL}"
MAIL_TRANSPORT=console
ENV
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
fi

say "Installing dependencies"
as_app "npm ci --no-audit --no-fund"

say "Applying the database schema"
as_app "npm run db:migrate"

if [[ $SEED_DEMO_DATA == "yes" ]]; then
  say "Seeding demo data"
  as_app "npm run db:seed"
fi

say "Building the frontend"
as_app "npm run build"

# Nginx (running as www-data) reads dist/ straight off disk, which means it
# needs to traverse the home directory to reach it.
chmod o+x "$(dirname "$APP_DIR")" 2>/dev/null || true
chmod o+x "$APP_DIR"
chmod -R o+rX "$APP_DIR/dist"

say "Installing the systemd service"
cat > /etc/systemd/system/songisathi-api.service <<UNIT
[Unit]
Description=SongiSathi API
After=network.target mysql.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now songisathi-api
systemctl restart songisathi-api

# The unit restarts on failure, so a status check straight away can report a
# doomed process as healthy. Poll the health endpoint instead.
say "Waiting for the API"
for _ in {1..15}; do
  if curl -fsS "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1; then
    echo "  API is up on ${API_PORT}"
    break
  fi
  sleep 1
done
curl -fsS "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1 || {
  journalctl -u songisathi-api -n 30 --no-pager || true
  die "The API did not come up — see the log above."
}

# Anything already holding port 80 (Apache ships enabled on some images) has to
# go before Nginx can bind. Stopping someone else's web server is not this
# script's call, so it stops and asks.
if ss -ltnp 2>/dev/null | grep -q ':80 .*apache2'; then
  warn "Apache is holding port 80. Nginx cannot start until it stops:"
  warn "    sudo systemctl disable --now apache2"
  die "Stop Apache (or free port 80) and re-run this script."
fi

say "Installing the Nginx site"
cat > /etc/nginx/sites-available/songisathi <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    root ${APP_DIR}/dist;
    index index.html;

    # Gallery photographs travel as base64 inside JSON bodies; the API caps
    # them at 4mb, so this only has to sit above that.
    client_max_body_size 8m;

    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # React Router owns the paths, so anything not on disk gets the app shell.
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/songisathi /etc/nginx/sites-enabled/songisathi
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

if [[ $ENABLE_UFW == "yes" ]]; then
  say "Configuring the firewall"
  apt-get install -y -qq ufw
  ufw allow OpenSSH
  ufw allow 'Nginx Full'
  ufw --force enable
fi

if [[ $ENABLE_TLS == "yes" ]]; then
  if [[ $DOMAIN == "_" ]]; then
    warn "ENABLE_TLS is yes but DOMAIN is \"_\" — skipping certbot."
  else
    say "Requesting a certificate for ${DOMAIN}"
    apt-get install -y -qq certbot python3-certbot-nginx
    if [[ -n ${LETSENCRYPT_EMAIL:-} ]]; then
      certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
        -m "$LETSENCRYPT_EMAIL" --redirect
    else
      certbot --nginx -d "$DOMAIN"
    fi
  fi
fi

say "Done"
echo "  Site:    ${APP_URL}"
echo "  API:     http://127.0.0.1:${API_PORT}/api/health"
echo "  Logs:    sudo journalctl -u songisathi-api -f"
echo "  Redeploy: sudo bash deploy/update.sh"
echo
warn "Email is still on the console transport: verification and password-reset"
warn "links are only printed to the journal, so nobody can finish a signup"
warn "unaided. Implement deliver() in server/mailer.js before going live."
