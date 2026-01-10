# Quick Start Guide

Get OwnRSVP running in minutes with Docker Compose.

## Prerequisites

- Docker and Docker Compose installed
- SMTP credentials (Gmail, SendGrid, or Mailgun)

## 5-Minute Setup

### Step 1: Configure Environment

```bash
cd rsvp-app
cp .env.example .env
```

Edit `.env` and set these **required** variables:

```env
# Generate: openssl rand -base64 32
AUTH_SECRET="paste-generated-secret-here"

# For local development:
AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# For production, use your domain:
# AUTH_URL="https://your-domain.com"
# NEXT_PUBLIC_APP_URL="https://your-domain.com"

AUTH_TRUST_HOST="true"

# SMTP (Gmail example)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="Events <noreply@your-domain.com>"
```

### Step 2: Start Services

```bash
docker compose up -d
```

### Step 3: Wait for Startup

Wait 30-60 seconds for services to start. Check status:

```bash
docker compose ps
```

You should see:
- `db` - running (healthy)
- `migrate` - exited (0) ✓
- `app` - running (healthy)

### Step 4: Verify

Test the health endpoint:

```bash
curl http://localhost:3000/api/health
```

Expected: `{"status":"ok"}`

### Step 5: Create Account

1. Open browser: `http://localhost:3000/register`
2. Fill in your details
3. Click "Register"
4. Start creating events!

## Gmail SMTP Setup

If using Gmail:

1. Enable 2-Factor Authentication
2. Go to [App Passwords](https://myaccount.google.com/apppasswords)
3. Generate password for "Mail"
4. Use the 16-character password in `SMTP_PASSWORD`

## Troubleshooting

**Services won't start?**
```bash
docker compose logs
```

**Port 3000 in use?**
Change port in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Use port 3001 instead
```

**Need help?**
See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## Next Steps

- [Full Deployment Guide](DEPLOYMENT.md)
- [README](README.md)
- Configure reverse proxy for production
- Set up automated reminders

