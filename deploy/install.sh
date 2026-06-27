#!/usr/bin/env bash
# Run ONCE on zima with sudo:  sudo bash /home/jp/typing-game/deploy/install.sh
# Installs the typing-game systemd service and adds the /typing route to Caddy.
# Safe: validates the Caddyfile and backs up the old one before touching anything.
set -euo pipefail
APP=/home/jp/typing-game

echo "[1/4] Installing systemd service (typing-game)…"
cp "$APP/deploy/typing-game.service" /etc/systemd/system/typing-game.service
systemctl daemon-reload
systemctl enable --now typing-game.service
sleep 1
systemctl is-active --quiet typing-game.service && echo "    ✓ typing-game is running" \
  || { echo "    ✗ service failed:"; journalctl -u typing-game --no-pager -n 20; exit 1; }

echo "[2/4] Validating the new Caddyfile…"
set -a; [ -f /etc/caddy/tasks.env ] && . /etc/caddy/tasks.env; set +a
: "${LAN_IP:=192.168.111.27}"; export LAN_IP
: "${TASKS_TOKEN:=placeholder}"; export TASKS_TOKEN
caddy validate --config "$APP/deploy/Caddyfile" --adapter caddyfile

echo "[3/4] Backing up and installing Caddyfile…"
cp -a /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak.$(date +%Y%m%d-%H%M%S)"
cp "$APP/deploy/Caddyfile" /etc/caddy/Caddyfile

echo "[4/4] Restarting Caddy…"
# NOTE: this config sets `admin off`, so `caddy reload` (admin API) won't work —
# a restart is required to load the new on-disk config.
if ! systemctl restart caddy || ! systemctl is-active --quiet caddy; then
  echo "    ✗ Caddy unhealthy — restoring backup"
  cp -a "$(ls -t /etc/caddy/Caddyfile.bak.* | head -1)" /etc/caddy/Caddyfile
  systemctl restart caddy
  exit 1
fi
echo "    ✓ Caddy restarted with new config"

echo
echo "✅ DONE — Typing Quest is live at:  http://${LAN_IP}/typing/"
echo "   (Tasks app on / is untouched.)"
