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
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:ownrsvp@db:5432/rsvp_db?schema=public
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_PASSWORD=ownrsvp
      - POSTGRES_DB=rsvp_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

**2. Start it:**

```bash
docker compose up -d
```

**3. Open http://localhost:3000 and create your admin account.**

That's it. No `.env` file needed.

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
environment:
  - SMTP_HOST=smtp.gmail.com
  - SMTP_PORT=587
  - SMTP_USER=your-email@gmail.com
  - SMTP_PASSWORD=your-app-password
  - SMTP_FROM=Events <noreply@yourdomain.com>
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
  - DATABASE_URL=postgresql://postgres:ownrsvp@db:5432/rsvp_db?schema=public
  - AUTH_URL=https://yourdomain.com
  - NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Change Database Password

```yaml
services:
  app:
    environment:
      - DATABASE_URL=postgresql://postgres:YOUR_SECURE_PASSWORD@db:5432/rsvp_db?schema=public
  db:
    environment:
      - POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD
```

## Backups

```bash
# Backup
docker compose exec db pg_dump -U postgres rsvp_db > backup.sql

# Restore
docker compose exec -T db psql -U postgres rsvp_db < backup.sql
```

## Development

```bash
# Clone
git clone https://github.com/DGATX/ownrsvp.git
cd ownrsvp

# Install
npm install

# Start database
docker run --name rsvp-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=rsvp_db -p 5432:5432 -d postgres:16-alpine

# Setup database
npm run db:push

# Run
npm run dev
```

## Tech Stack

- **Framework**: Next.js 14
- **Database**: PostgreSQL
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
curl http://localhost:3000/api/health

# Reset everything (deletes data)
docker compose down -v
docker compose up -d
```

## License

MIT License - see [LICENSE](LICENSE) file.
