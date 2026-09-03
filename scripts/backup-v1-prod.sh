#!/usr/bin/env bash
# Backs up the exact artifacts production serves. Run from repo root.
# Restore: untar over the dist/ dirs, restart backend.
set -euo pipefail
STAMP=$(date +%F-%H%M)
DEST="$HOME/backups/v1-prod-$STAMP"
mkdir -p "$DEST"
[ -d meet-frontend/dist ] && tar czf "$DEST/frontend-dist.tar.gz" -C meet-frontend dist
[ -d meet-backend/dist ]  && tar czf "$DEST/backend-dist.tar.gz"  -C meet-backend  dist
[ -f meet-backend/.env ]  && cp meet-backend/.env "$DEST/backend.env"  && chmod 600 "$DEST/backend.env"
[ -f meet-frontend/.env ] && cp meet-frontend/.env "$DEST/frontend.env" && chmod 600 "$DEST/frontend.env"
echo "Backup at $DEST"
ls -l "$DEST"
