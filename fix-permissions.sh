#!/bin/bash
# Fix permissions for Next.js node_modules

cd "$(dirname "$0")"

echo "Fixing permissions for node_modules..."

# Remove quarantine attributes
xattr -rc node_modules 2>/dev/null || true

# Fix read permissions
chmod -R u+r node_modules 2>/dev/null || true

# Specifically fix Next.js files
chmod -R u+r node_modules/next 2>/dev/null || true

echo "Permissions fixed. Try running 'npm run dev' again."

