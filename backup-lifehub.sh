#!/bin/bash
# Life Hub Database Backup Script
# Run via cron on TrueNAS/HexOS to back up the PostgreSQL database.
#
# Usage: ./backup-lifehub.sh
# Cron example (daily at 3am): 0 3 * * * /root/backup-lifehub.sh
#
# Saves timestamped .sql.gz files and deletes backups older than 30 days.

BACKUP_DIR="/root/lifehub-backups"
CONTAINER_NAME="life-hub-main-db-1"
DB_NAME="lifehub"
DB_USER="lifehub"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamped filename
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/lifehub_$TIMESTAMP.sql.gz"

# Run pg_dump inside the container and compress
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

# Check if backup succeeded
if [ $? -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
    echo "Backup successful: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
    echo "ERROR: Backup failed!" >&2
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Delete backups older than retention period
find "$BACKUP_DIR" -name "lifehub_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "Cleaned up backups older than $RETENTION_DAYS days"
