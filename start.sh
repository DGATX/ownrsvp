#!/bin/sh
set -e

# Ensure data directory exists
mkdir -p /app/data

# Generate AUTH_SECRET if not provided or set to "auto"
SECRET_FILE="/app/data/.auth-secret"
if [ -z "$AUTH_SECRET" ] || [ "$AUTH_SECRET" = "auto" ]; then
    if [ -f "$SECRET_FILE" ]; then
        echo "Loading existing AUTH_SECRET..."
        export AUTH_SECRET=$(cat "$SECRET_FILE")
    else
        echo "Generating new AUTH_SECRET..."
        export AUTH_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
        echo "$AUTH_SECRET" > "$SECRET_FILE"
        echo "AUTH_SECRET saved to $SECRET_FILE"
    fi
fi

echo "Running database migrations..."
npx prisma@5.22.0 migrate deploy

echo "Starting application..."
exec node server.js
