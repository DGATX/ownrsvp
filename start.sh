#!/bin/sh
set -e

# Ensure data directory exists and has correct permissions
# This runs as root to fix any permission issues with Docker volumes
mkdir -p /app/data
chown -R nextjs:nodejs /app/data

# Generate AUTH_SECRET if not provided or set to "auto"
SECRET_FILE="/app/data/.auth-secret"
if [ -z "$AUTH_SECRET" ] || [ "$AUTH_SECRET" = "auto" ]; then
    if [ -f "$SECRET_FILE" ]; then
        echo "Loading existing AUTH_SECRET..."
        export AUTH_SECRET=$(cat "$SECRET_FILE")
    else
        echo "Generating new AUTH_SECRET..."
        export AUTH_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
        # Write secret file as nextjs user
        su-exec nextjs:nodejs sh -c "echo '$AUTH_SECRET' > '$SECRET_FILE'"
        echo "AUTH_SECRET saved to $SECRET_FILE"
    fi
fi

echo "Running database migrations..."
su-exec nextjs:nodejs npx prisma@5.22.0 migrate deploy

echo "Starting application..."
exec su-exec nextjs:nodejs node server.js
