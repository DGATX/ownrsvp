# Quick Start Guide

Two ways to deploy OwnRSVP:

## Option 1: Docker Hub (Fastest - Recommended for Users)

Perfect for quick deployment using pre-built image.

### Step 1: Download Configuration

```bash
# Download docker compose and environment template
wget https://raw.githubusercontent.com/DGATX/ownrsvp/main/docker-compose.yml
wget https://raw.githubusercontent.com/DGATX/ownrsvp/main/.env.example
```

### Step 2: Configure Environment

```bash
# Copy template
cp .env.example .env

# Edit .env and configure:
nano .env  # or use your preferred editor
```

**Minimum required settings:**
- `AUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` - For email invitations

### Step 3: Start Services

```bash
docker compose up -d
```

### Step 4: Verify Installation

```bash
# Check if services are running
docker compose ps

# View logs
docker compose logs -f

# Check health
curl http://localhost:3000/api/health
```

Visit http://localhost:3000/register to create your account!

---

## Option 2: Build from Source (For Developers)

Perfect if you want to modify the code.

### Step 1: Clone Repository

```bash
git clone https://github.com/DGATX/ownrsvp.git
cd ownrsvp
```

### Step 2: Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### Step 3: Build and Start

```bash
# Use development compose file
docker compose -f docker-compose.dev.yml up -d

# Monitor build progress
docker compose -f docker-compose.dev.yml logs -f
```

### Step 4: Access Application

Visit http://localhost:3000/register

---

## Prerequisites

- Docker and Docker Compose installed
- SMTP credentials (Gmail, SendGrid, or Mailgun)

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

