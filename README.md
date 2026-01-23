# OwnRSVP - Self-Hosted Event Management

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Pulls](https://img.shields.io/docker/pulls/dgatx/ownrsvp.svg)](https://hub.docker.com/r/dgatx/ownrsvp)
[![Docker Image Size](https://img.shields.io/docker/image-size/dgatx/ownrsvp/latest)](https://hub.docker.com/r/dgatx/ownrsvp)

A beautiful, self-hosted event invitation and RSVP management platform. Create events, send email invitations, and track RSVPs—all from your own server.

## Quick Start (2 minutes)

**1. Create a `docker-compose.yml` file:**

```yaml
services:
  app:
    image: dgatx/ownrsvp:latest
    container_name: ownrsvp
    ports:
      - "7787:7787"
    volumes:
      - ownrsvp_data:/app/data
    restart: unless-stopped

volumes:
  ownrsvp_data:
```

> **Why port 7787?** It spells "RSVP" on a phone keypad!

**2. Start it:**

```bash
docker compose up -d
```

**3. Open http://localhost:7787 and create your admin account.**

That's it. No database setup, no `.env` file needed.

## Features

- **Event Management**: Create and manage events with custom details
- **Email Invitations**: Send beautiful HTML email invitations
- **RSVP Tracking**: Track attending, maybe, and declined responses
- **Guest Wall**: Let guests leave messages and comments
- **Automated Reminders**: Send reminder emails to pending guests
- **Plus-One Support**: Guests can bring additional guests
- **Dietary Tracking**: Collect dietary restrictions
- **Self-Hosted**: Your data stays on your server

## Configuration

### Email (SMTP)

You can configure email two ways:

**Option 1: Admin UI** (recommended)
1. Log in as admin
2. Go to Admin → Configuration
3. Enter your SMTP settings

**Option 2: Environment variables**

```yaml
services:
  app:
    image: dgatx/ownrsvp:latest
    container_name: ownrsvp
    ports:
      - "7787:7787"
    environment:
      - SMTP_HOST=smtp.gmail.com
      - SMTP_PORT=587
      - SMTP_USER=your-email@gmail.com
      - SMTP_PASSWORD=your-app-password
      - SMTP_FROM=Events <noreply@yourdomain.com>
    volumes:
      - ownrsvp_data:/app/data

volumes:
  ownrsvp_data:
```

### Gmail Setup

1. Enable 2-Factor Authentication on your Google account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Generate a new app password
4. Use that password as `SMTP_PASSWORD`

### Custom Domain

For production with your own domain:

```yaml
environment:
  - AUTH_URL=https://yourdomain.com
  - NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Backups

```bash
# Backup (copies the SQLite database)
docker compose cp app:/app/data/ownrsvp.db ./backup.db

# Restore
docker compose cp ./backup.db app:/app/data/ownrsvp.db
docker compose restart app
```

## Development

```bash
# Clone
git clone https://github.com/DGATX/ownrsvp.git
cd ownrsvp

# Install
npm install

# Setup database
npm run db:migrate

# Run
npm run dev
```

## Tech Stack

- **Framework**: Next.js 14
- **Database**: SQLite
- **ORM**: Prisma
- **Auth**: NextAuth.js
- **Styling**: Tailwind CSS

## Troubleshooting

```bash
# Check status
docker compose ps

# View logs
docker compose logs -f

# Health check
curl http://localhost:7787/api/health

# Reset everything (deletes data)
docker compose down -v
docker compose up -d
```

## License

MIT License - see [LICENSE](LICENSE) file.
