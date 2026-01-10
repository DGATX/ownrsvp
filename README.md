# OwnRSVP - Self-Hosted Event Management

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Pulls](https://img.shields.io/docker/pulls/dgatx/ownrsvp.svg)](https://hub.docker.com/r/dgatx/ownrsvp)
[![Docker Image Size](https://img.shields.io/docker/image-size/dgatx/ownrsvp/latest)](https://hub.docker.com/r/dgatx/ownrsvp)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

A beautiful, self-hosted event invitation and RSVP management platform. Create events, send email invitations, and track RSVPs—all from your own server.

## Quick Start (3 steps, 5 minutes)

### Using Pre-Built Docker Image (Recommended)

```bash
# 1. Download configuration files
curl -O https://raw.githubusercontent.com/DGATX/ownrsvp/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/DGATX/ownrsvp/main/.env.example

# 2. Configure your environment
cp .env.example .env
# Edit .env and set:
#   - AUTH_SECRET (generate: openssl rand -base64 32)
#   - SMTP settings (for email invitations)

# 3. Start the application
docker compose up -d

# 4. Visit http://localhost:3000/register to create your account
```

### Building from Source

```bash
# 1. Clone repository
git clone https://github.com/DGATX/ownrsvp.git
cd ownrsvp

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings

# 3. Build and start
docker compose -f docker-compose.dev.yml up -d
```

**Need more details?** See [QUICKSTART.md](QUICKSTART.md) for step-by-step instructions.

**Full deployment guide:** See [DEPLOYMENT.md](DEPLOYMENT.md) for comprehensive instructions, troubleshooting, and production setup.

## Features

- **Event Management**: Create and manage events with custom details
- **Email Invitations**: Send beautiful HTML email invitations to guests
- **Public Event Pages**: Shareable event links for easy access
- **RSVP Tracking**: Track attending, maybe, and declined responses
- **Guest Wall**: Let guests leave messages and comments
- **Automated Reminders**: Send reminder emails to pending guests
- **Plus-One Support**: Guests can bring plus-ones
- **Dietary Tracking**: Collect dietary restrictions from guests
- **Self-Hosted**: Your data stays on your server

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL / SQLite
- **ORM**: Prisma
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS
- **Email**: Nodemailer

## Docker Deployment

### Prerequisites

- **Docker** version 20.10+ and **Docker Compose** version 2.0+
- **SMTP credentials** (Gmail, SendGrid, Mailgun, etc.)

Verify installation:
```bash
docker --version
docker compose version
```

### Step-by-Step Setup

#### 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings. **Minimum required configuration:**

```env
# Generate: openssl rand -base64 32
AUTH_SECRET="your-generated-secret"

# For local development:
AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# For production, use your domain:
# AUTH_URL="https://your-domain.com"
# NEXT_PUBLIC_APP_URL="https://your-domain.com"

AUTH_TRUST_HOST="true"

# SMTP Configuration (required)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="Events <noreply@your-domain.com>"
```

#### 2. Start Services

```bash
docker compose up -d
```

**What happens:**
1. PostgreSQL database starts and becomes healthy
2. Migration service runs database migrations (exits when complete)
3. Application starts after migrations complete

**First startup:** Migrations may take 30-60 seconds. The app is ready when `http://localhost:3000/api/health` returns `{"status":"ok"}`.

#### 3. Verify Installation

Check service status:
```bash
docker compose ps
```

Expected output:
```
NAME      STATUS
app       running (healthy)
db        running (healthy)
migrate   exited (0)
```

#### 4. Create Your Account

1. Visit `http://localhost:3000/register`
2. Fill in your details and register
3. Start creating events!

> **Admin Access:** The first user has regular USER role. To make yourself admin:
> ```bash
> docker compose exec db psql -U postgres -d rsvp_db -c "UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'your-email@example.com';"
> ```

## Email Configuration

### Gmail

1. Enable 2-Factor Authentication
2. Generate an App Password: Google Account → Security → App Passwords
3. Use the app password in `SMTP_PASSWORD`

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
```

### SendGrid

```env
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASSWORD="your-sendgrid-api-key"
```

### Mailgun

```env
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT="587"
SMTP_USER="postmaster@your-domain.mailgun.org"
SMTP_PASSWORD="your-mailgun-password"
```

## Reverse Proxy Setup

OwnRSVP works behind reverse proxies like nginx, Apache, or Caddy.

**Important Configuration:**
- Set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your public domain (e.g., `https://yourdomain.com`)
- Set `AUTH_TRUST_HOST=true` when behind a reverse proxy
- Ensure your reverse proxy forwards proper headers (X-Forwarded-For, X-Forwarded-Proto, etc.)

## Automated Reminders

The app includes an API endpoint for sending automated reminders to guests who haven't responded.

### Using External Cron Service

Set up a cron job to call the reminder endpoint daily:

```bash
# Daily at 9 AM
curl -X POST https://your-domain.com/api/cron/reminders \
  -H "Authorization: Bearer your-cron-secret"
```

Services like [cron-job.org](https://cron-job.org) or [EasyCron](https://www.easycron.com) work great for this.

## Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL (or use Docker for DB only)

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

```bash
# Start PostgreSQL with Docker
docker run --name rsvp-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=rsvp_db -p 5432:5432 -d postgres:16-alpine

# Push schema to database
npm run db:push
```

### 3. Start Development Server

```bash
npm run dev
```

## Project Structure

```
rsvp-app/
├── src/
│   ├── app/                  # Next.js pages and API routes
│   │   ├── (auth)/          # Auth pages (login, register)
│   │   ├── (dashboard)/     # Protected dashboard pages
│   │   ├── events/          # Public event pages
│   │   ├── rsvp/            # RSVP token redirect
│   │   └── api/             # API routes
│   ├── components/          # React components
│   │   └── ui/              # UI components (buttons, cards, etc.)
│   └── lib/                 # Utilities (Prisma, email, etc.)
├── prisma/
│   └── schema.prisma        # Database schema
├── Dockerfile               # Production container
├── docker-compose.yml       # Docker Compose configuration
└── package.json
```

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/events` | Create event |
| GET | `/api/events` | List user's events |
| POST | `/api/events/[id]/guests` | Add guest to event |
| POST | `/api/events/[id]/guests/[guestId]/invite` | Send invitation |
| POST | `/api/events/[id]/guests/[guestId]/remind` | Send reminder |
| DELETE | `/api/events/[id]/guests/[guestId]` | Remove guest |
| POST | `/api/rsvp` | Submit RSVP (public) |
| POST | `/api/comments` | Post comment (public) |
| POST | `/api/cron/reminders` | Trigger reminder emails |

## Production Security Checklist

- [ ] Change `POSTGRES_PASSWORD` from default
- [ ] Use strong `AUTH_SECRET` (generate with `openssl rand -base64 32`)
- [ ] Set `CRON_SECRET` for protecting reminder endpoint
- [ ] Use HTTPS (SSL/TLS certificate)
- [ ] Configure firewall rules
- [ ] Set up regular database backups
- [ ] Review and restrict admin access

### Database Backups

**Manual backup:**
```bash
docker compose exec db pg_dump -U postgres rsvp_db > backup.sql
```

**Restore:**
```bash
docker compose exec -T db psql -U postgres rsvp_db < backup.sql
```

## Troubleshooting

### Quick Diagnostics

```bash
# Check service status
docker compose ps

# View logs
docker compose logs -f          # All services
docker compose logs app         # Application only

# Test health endpoint
curl http://localhost:3000/api/health
```

### Common Issues

#### Database Connection Errors
```bash
# Verify database is running
docker compose ps db

# Check database health
docker compose exec db pg_isready -U postgres

# Restart database
docker compose restart db
```

#### Migration Errors
```bash
# Check migration logs
docker compose logs migrate

# Reset database (WARNING: Deletes all data)
docker compose down -v
docker compose up -d
```

#### Email Not Sending
1. Verify SMTP credentials in `.env` or admin panel
2. Test email in admin panel (Admin → Configuration → Test Email)
3. **Gmail users:** Ensure you're using an App Password, not your regular password

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.
