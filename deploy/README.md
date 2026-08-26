# Deploying SongiSathi Ghotok

Two moving parts: the Express API on port 4000, and the Vite build in `dist/`.
Nginx serves the build and proxies `/api/` to the API. Express never serves the
frontend itself, which is why a web server in front is not optional.

## A fresh Ubuntu server

Tested on Ubuntu 24.04. You need a sudo-capable user and, for TLS, a domain
whose A record already points at the box.

```bash
git clone <repo-url> ~/songisathi-ghotok
cd ~/songisathi-ghotok
cp deploy/deploy.conf.example deploy/deploy.conf
nano deploy/deploy.conf          # at minimum: APP_USER, APP_DIR, DB_PASS
sudo bash deploy/setup.sh
```

The script installs Node, MySQL and Nginx, creates the database user, writes
`.env`, installs dependencies, migrates, builds, and installs both the systemd
unit and the Nginx site. It is idempotent — re-running it is how you apply a
changed `deploy.conf`.

`deploy.conf` holds the database password, so it is git-ignored. Keep it at
`chmod 600` on the server.

### Two things it will stop for

**Apache on port 80.** Some images ship it enabled. Nginx cannot bind while it
holds the port, and shutting down a web server that might be serving something
else is not the script's decision:

```bash
sudo systemctl disable --now apache2
```

**A missing user.** `APP_USER` has to exist already; the script will not create
accounts.

## Redeploying

```bash
sudo bash deploy/update.sh
```

Pull, install, migrate, build, restart. `db:migrate` only creates tables that
are missing — it does not alter existing ones, so a schema change to a live
table needs SQL written by hand.

## Where things live

| | |
|---|---|
| Service | `/etc/systemd/system/songisathi-api.service` |
| Site | `/etc/nginx/sites-available/songisathi` |
| Secrets | `<APP_DIR>/.env` (never overwritten once created) |
| API logs | `sudo journalctl -u songisathi-api -f` |
| Nginx logs | `/var/log/nginx/error.log` |

## Before real users arrive

- **Email does not send.** `MAIL_TRANSPORT=console` prints verification and
  password-reset links to the journal instead of delivering them, so nobody can
  finish a signup unaided. Implement `deliver()` in `server/mailer.js` with an
  SMTP transport, then set `MAIL_TRANSPORT` and the SMTP variables in `.env`.
- **CORS is open.** `server/index.js` calls `cors()` with no origin allowlist.
  Behind this Nginx setup the frontend is same-origin, so it costs nothing to
  restrict it.
- **Nothing backs up the database.** A nightly `mysqldump` on cron is the
  smallest thing that would count.

## Notes from setting this up by hand

Things that cost time the first time round, in case you are debugging a server
that was not built by the script:

- systemd does not expand `~`. `WorkingDirectory` must be an absolute path, or
  the unit dies with `200/CHDIR`.
- `203/EXEC` means the `ExecStart` binary is not there. If Node came from nvm it
  lives under the user's home, not `/usr/bin` — install Node system-wide rather
  than pointing the unit into `~/.nvm`, which breaks the day that version is
  removed.
- `Restart=always` makes a failing service read as `active (running)` for the
  first moment after a restart. Check the health endpoint, not the status line.
- If the service runs as a different user than the one that owns `.env`, it
  starts and exits 1: the file is mode 600 and `DATABASE_URL` never loads.
- `npm` run under `sudo` leaves root-owned files behind, and the next ordinary
  build fails with `EACCES` on the temporary config Vite writes beside
  `vite.config.js`.
