#!/bin/bash

# Meet Conference Daily Backup Script
# Backs up the meet-conference project if changes are detected

set -e

PROJECT_DIR="/home/jspace/meet-conference"
BACKUP_DIR="/home/jspace/backups/meet-conference"
LOG_FILE="$BACKUP_DIR/backup.log"
LAST_INFO="$BACKUP_DIR/.last_backup_info"
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
BACKUP_FILE="$BACKUP_DIR/meet-conference-$DATE.tar.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

log() {
    echo "[$TIMESTAMP] $1" >> "$LOG_FILE"
    echo -e "\033[0;32m$1\033[0m"
}

log_warn() {
    echo "[$TIMESTAMP] [WARN] $1" >> "$LOG_FILE"
    echo -e "\033[0;33m[WARN] $1\033[0m"
}

log "Starting backup check..."

# Check for changes using find with newermt
if [ -f "$LAST_INFO" ]; then
    LAST_BACKUP_TIME=$(cat "$LAST_INFO")
    CHANGES=$(find "$PROJECT_DIR" \
        -type f \
        -newermt "$LAST_BACKUP_TIME" \
        ! -path "*/node_modules/*" \
        ! -path "*/dist/*" \
        ! -path "*/.git/*" \
        ! -path "*/logs/*" \
        ! -path "*/.code-review-graph/*" \
        2>/dev/null | head -1)
    
    if [ -z "$CHANGES" ]; then
        log "No changes detected. Skipping backup."
        exit 0
    fi
    log "Changes detected since last backup."
else
    log "No previous backup found. Creating first backup."
fi

# Check if backup already exists for today
if [ -f "$BACKUP_FILE" ]; then
    log_warn "Backup already exists for today: $BACKUP_FILE"
    log "New changes detected. Replacing today's backup."
    rm -f "$BACKUP_FILE"
fi

# Create backup (excluding large/generated directories)
log "Creating backup: $BACKUP_FILE"
tar -czf "$BACKUP_FILE" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='build' \
    --exclude='.git' \
    --exclude='logs' \
    --exclude='.code-review-graph' \
    --exclude='coverage' \
    --exclude='.backup' \
    --exclude='.tmp' \
    -C "$(dirname "$PROJECT_DIR")" \
    "$(basename "$PROJECT_DIR")" 2>/dev/null

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# Update last backup info
date '+%Y-%m-%d %H:%M:%S' > "$LAST_INFO"

log "Backup process completed."
