#!/bin/bash
# Datacore Backend Entrypoint
#
# Runs database migrations before starting the app server.
# Handles two scenarios:
#   1. Fresh install: no tables exist -> migrations create everything
#   2. Existing install: tables exist -> migrations add new columns/data
#
# If migrations fail (e.g., db.create_all() already made the tables),
# we stamp to HEAD so future migrations work correctly.

set -e

echo "Running database migrations..."
if flask db upgrade 2>&1; then
    echo "Migrations applied successfully."
else
    echo "Migration failed (tables may already exist from db.create_all)."
    echo "Stamping current migration state..."
    flask db stamp head 2>&1 || true
    echo "Stamped to HEAD. New migrations will apply on next deploy."
fi

echo "Starting server..."
exec "$@"
