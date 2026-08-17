#!/bin/bash
set -euxo pipefail

REPO_URL="https://github.com/simon1820/analizador-ia.git"
APP_DIR="/opt/analizador-ia"

dnf install -y git
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
dnf install -y nodejs

corepack enable
corepack prepare pnpm@11.9.0 --activate

id -u app &>/dev/null || useradd --system --create-home --shell /sbin/nologin app

git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"
pnpm install --frozen-lockfile
pnpm run build
chown -R app:app "$APP_DIR"

cat > /etc/systemd/system/analizador.service <<'UNIT'
[Unit]
Description=Analizador de resenas
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=app
WorkingDirectory=/opt/analizador-ia
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now analizador.service