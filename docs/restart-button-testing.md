# Restart Button Testing Guide

This document explains how the restart button works in different environments and how to test it.

## How It Works

The restart button detects the environment and uses the appropriate restart method:

1. **PM2** (if detected) - Executes `pm2 restart <app-name>`
2. **Docker Compose** (if detected) - Provides instructions for `docker compose restart app`
3. **Docker Container** (if detected) - Provides instructions for `docker restart <container>`
4. **systemd** (if detected) - Executes `systemctl restart <service-name>`
5. **Graceful Shutdown** (fallback) - Shuts down the process gracefully

## Testing in Development

**Current Environment:** Development (npm run dev)

**Expected Behavior:**
- Detects as "Graceful Shutdown"
- When clicked, server will shut down gracefully
- User must manually restart with `npm run dev`

**To Test:**
1. Go to Admin Dashboard
2. Click "Restart Server" button
3. Confirm in the dialog
4. Server should shut down
5. Restart manually with `npm run dev`

## Testing in Production with PM2

**Setup:**
```bash
pm2 start npm --name "ownrsvp" -- start
```

**Expected Behavior:**
- Detects as "PM2 Process Manager"
- Executes `pm2 restart ownrsvp`
- Server restarts automatically

**To Test:**
1. Ensure app is running under PM2
2. Click restart button
3. Server should restart automatically
4. Page should refresh after restart

## Testing with Docker Compose

**Setup:**
```bash
docker compose up -d
```

**Expected Behavior:**
- If running inside container: Detects Docker, provides instructions
- If running on host: Can execute `docker compose restart app`

**To Test:**
1. Run app with `docker compose up -d`
2. Click restart button
3. If inside container: Shows instructions to restart from host
4. If on host: Attempts to restart via docker compose

## Testing with Docker (Standalone Container)

**Setup:**
```bash
docker run -d --name ownrsvp-app your-image
```

**Expected Behavior:**
- Detects Docker container
- Provides restart instructions
- May attempt restart if docker command available

## Testing with systemd

**Setup:**
Create a systemd service file for the app.

**Expected Behavior:**
- Detects systemd service
- Executes `systemctl restart <service-name>`
- Requires proper permissions

## Common Issues and Solutions

### Issue: "Command not found" in Docker

**Solution:** This is expected when running inside a Docker container. The container cannot restart itself. Use the provided instructions to restart from the host.

### Issue: Permission Denied

**Solution:** The restart command requires elevated permissions. Use the provided manual restart instructions.

### Issue: Server doesn't restart automatically

**Solution:** In development or when graceful shutdown is used, manual restart is required. This is expected behavior.

## Environment Detection Logic

The restart button checks in this order:

1. **PM2** - Checks for `process.env.pm_id` or `process.env.PM2_HOME`
2. **Docker** - Checks for `/.dockerenv` file or `DOCKER_CONTAINER` env var
3. **Docker Compose** - Tries to detect docker-compose setup
4. **systemd** - Checks if `systemctl` is available
5. **Graceful Shutdown** - Fallback for all other cases

## Manual Restart Commands

- **Development:** `npm run dev`
- **Production:** `npm start`
- **PM2:** `pm2 restart ownrsvp`
- **Docker Compose:** `docker compose restart app`
- **Docker:** `docker restart <container-name>`
- **systemd:** `systemctl restart ownrsvp`

