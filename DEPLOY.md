# Deploying Ɔbɔfo on an Ubuntu server

Ɔbɔfo runs as **two long-running processes** plus a database:

| Process | What it is | Command |
| --- | --- | --- |
| **Web** | Next.js app (port `3009`) | `npm run start` |
| **Worker** | Owns every user's WhatsApp socket; sends alerts | `npm run worker` |
| **DB** | PostgreSQL | — |

> ⚠️ **Run exactly one worker instance.** It keeps WhatsApp sockets in memory
> (`src/server/session-manager.ts`), so it must **not** be clustered or replicated.
> The web app can be a single instance too.

Tested on Ubuntu 22.04 / 24.04.

---

## 1. Install prerequisites

```bash
sudo apt update && sudo apt -y upgrade
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git postgresql nginx
node -v   # expect v20.x
```

## 2. Create the database

```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE obofo;
CREATE USER obofo WITH ENCRYPTED PASSWORD 'CHANGE_ME_STRONG';
GRANT ALL PRIVILEGES ON DATABASE obofo TO obofo;
ALTER DATABASE obofo OWNER TO obofo;
SQL
```

## 3. Get the code

```bash
sudo mkdir -p /opt/obofo && sudo chown $USER:$USER /opt/obofo
git clone https://github.com/Eselase-Noble/Obofo.git /opt/obofo
cd /opt/obofo
git checkout production
```

## 4. Configure `.env`

```bash
cp .env.example .env
nano .env
```

Set at minimum:

```ini
DATABASE_URL="postgresql://obofo:CHANGE_ME_STRONG@localhost:5432/obofo?schema=public"
AUTH_SECRET="paste-output-of: openssl rand -hex 32"
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
ARKESEL_API_KEY=your_key
ARKESEL_SENDER_ID=Obofo
NODE_ENV=production
```

> The app issues **secure cookies in production**, so it **must** be served over
> **HTTPS** (step 7) or sign-ins won't persist.
> `GMAIL_APP_PASSWORD` must be a Google **App Password**, not your normal password.

## 5. Install, migrate, build

```bash
cd /opt/obofo
npm ci
npx prisma migrate deploy      # applies migrations (NOT `migrate dev`)
npx prisma generate
npm run build                  # needs outbound internet (self-hosted fonts fetched at build)
npm run create-admin -- --email you@yourdomain.com --name "You"   # first platform admin
```

## 6. Run both processes with systemd

Web service:

```bash
sudo tee /etc/systemd/system/obofo-web.service >/dev/null <<'EOF'
[Unit]
Description=Obofo web (Next.js)
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/obofo
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
EOF
```

Worker service:

```bash
sudo tee /etc/systemd/system/obofo-worker.service >/dev/null <<'EOF'
[Unit]
Description=Obofo WhatsApp worker
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/obofo
ExecStart=/usr/bin/npm run worker
Restart=always
RestartSec=5
Environment=NODE_ENV=production
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
EOF
```

Enable + start:

```bash
sudo chown -R www-data:www-data /opt/obofo
sudo systemctl daemon-reload
sudo systemctl enable --now obofo-web obofo-worker
sudo systemctl status obofo-web obofo-worker --no-pager
# follow logs:  sudo journalctl -u obofo-worker -f
```

## 7. Nginx reverse proxy + HTTPS

```bash
sudo tee /etc/nginx/sites-available/obofo >/dev/null <<'EOF'
server {
    server_name obofo.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3009;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/obofo /etc/nginx/sites-enabled/obofo
sudo nginx -t && sudo systemctl reload nginx

# TLS via Let's Encrypt (point the domain's A record at this server first)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d obofo.yourdomain.com   # auto-renews
```

## 8. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Keep **3009** (app) and **5432** (Postgres) internal only — do **not** `ufw allow` them.

---

## Redeploying updates

```bash
cd /opt/obofo
git pull origin production
npm ci
npx prisma migrate deploy
npm run build
sudo systemctl restart obofo-web obofo-worker
```

## Operational notes

- **One worker only.** Never scale `obofo-worker` — sessions live in memory.
  True HA would require a redesign (per-user socket ownership / locking).
- **Linking after deploy:** sign in on the site and link via QR or pairing code.
  Baileys credentials are stored in Postgres, so the worker auto-reconnects every
  linked session on restart (via `reconcile()`).
- **Back up Postgres** regularly — it holds auth credentials, watchlists, and
  WhatsApp session material: `pg_dump obofo > obofo-$(date +%F).sql`.
- **Platform console** lives at `/platform/login` (separate admin session).
  Add more admins with `npm run create-admin` or the "Add team member" button.
- Health check: `sudo journalctl -u obofo-worker -f` should show
  `session connected` for each linked account.
