#!/usr/bin/env bash
# deploy-prod.sh — one-command deploy of latest main to the production VPS.
#
# Runs entirely on the server over SSH:
#   1. git pull --ff-only origin main
#   2. backend:  npm install && npm run build
#   3. frontend: npm install && npm run build   (Caddy serves meet-frontend/dist directly)
#   4. restart backend under systemd (cuts over from any manual/rogue process on :4000)
#   5. health check
#
# Prereq: passwordless SSH to the host. An ~/.ssh/config alias `meet-vps` with a
# key in the server's authorized_keys is expected. Override the target with
# MEET_HOST and MEET_REMOTE_DIR if needed.
#
# Usage: ./deploy-prod.sh
set -euo pipefail

HOST="${MEET_HOST:-meet-vps}"
DIR="${MEET_REMOTE_DIR:-/home/jspace/meet-conference}"

echo "▶ Deploying latest main to ${HOST}:${DIR}"

ssh "$HOST" bash -s -- "$DIR" <<'SCRIPT'
set -euo pipefail
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"   # ssh bash -s is non-login; source nvm for npm/node
cd "$1"

echo "== git pull =="
git fetch origin main
git pull --ff-only origin main
echo "HEAD now: $(git log --oneline -1)"

echo "== backend: install + build =="
( cd meet-backend && npm install --loglevel=error && npm run build )

echo "== frontend: install + build (Caddy serves dist/ directly) =="
( cd meet-frontend && npm install --loglevel=error && npm run build )

echo "== restart backend under systemd (cutover from any manual process) =="
sudo systemctl stop meet-backend 2>/dev/null || true
sudo fuser -k 4000/tcp 2>/dev/null || true          # free :4000 from any rogue/manual proc
sleep 1
sudo systemctl enable meet-backend >/dev/null 2>&1 || true
sudo systemctl start meet-backend

echo "== health check =="
ok=false
for _ in $(seq 1 15); do
  if curl -sf -m 3 http://localhost:4000/health >/dev/null 2>&1; then ok=true; break; fi
  sleep 1
done
if [ "$ok" = true ]; then
  echo "✓ backend healthy: $(curl -s -m 3 http://localhost:4000/health)"
  echo "✓ systemd state:  $(systemctl is-active meet-backend) ($(systemctl is-enabled meet-backend 2>/dev/null))"
  echo "✓ HEAD:           $(git -C "$1" log --oneline -1)"
  exit 0
fi
echo "✗ backend did not become healthy; last logs:"
sudo journalctl -u meet-backend --no-pager -n 25
exit 1
SCRIPT

echo "✔ deploy complete"
