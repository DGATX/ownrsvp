# OwnRSVP - Self-Hosted Event Management

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Pulls](https://img.shields.io/docker/pulls/dgatx/ownrsvp.svg)](https://hub.docker.com/r/dgatx/ownrsvp)
[![Docker Image Size](https://img.shields.io/docker/image-size/dgatx/ownrsvp/latest)](https://hub.docker.com/r/dgatx/ownrsvp)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

A beautiful, self-hosted event invitation and RSVP management platform. Create events, send email invitations, and track RSVPs—all from your own server.

## 🚀 Quick Start (3 steps, 5 minutes)

### Using Pre-Built Docker Image (Recommended)

```bash
# 1. Download configuration files
# For Linux:
wget https://raw.githubusercontent.com/DGATX/ownrsvp/main/docker-compose.yml
wget https://raw.githubusercontent.com/DGATX/ownrsvp/main/.env.example

# For macOS:
curl -O https://raw.githubusercontent.com/DGATX/ownrsvp/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/DGATX/ownrsvp/main/.env.example

# 2. Configure your environment
cp .env.example .env
# Edit .env and set:
#   - AUTH_SECRET (generate: openssl rand -base64 32)
#   - SMTP settings (for email invitations)
#   - Optional: Twilio settings (for SMS)

# 3. Start the application
docker compose up -d

# 4. Visit http://localhost:3000/register to create your account
```

### Building from Source (For Developers)

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
- **SMS Notifications**: Send invitations, confirmations, and reminders via SMS (Twilio)
- **Public Event Pages**: Shareable event links for easy access
- **RSVP Tracking**: Track attending, maybe, and declined responses
- **Guest Wall**: Let guests leave messages and comments
- **Automated Reminders**: Send reminder emails and SMS to pending guests
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
- **SMS**: Twilio (optional)

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
cd rsvp-app
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

> **📖 See [DEPLOYMENT.md](DEPLOYMENT.md) for complete environment variable documentation**

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

Test health endpoint:
```bash
curl http://localhost:3000/api/health
```

#### 4. Create Your Account

1. Visit `http://localhost:3000/register`
2. Fill in your details and register
3. Start creating events!

> **💡 Admin Access:** The first user has regular USER role. To make yourself admin:
> - Database: `docker compose exec db psql -U postgres -d rsvp_db -c "UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'your-email@example.com';"`
> - Or use admin panel (if you have admin access)

### Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - 5-minute quick start guide
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Comprehensive deployment guide with troubleshooting
- **[docs/reverse-proxy.md](docs/reverse-proxy.md)** - Reverse proxy configuration

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

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your local settings
```

### 4. Start Development Server

```bash
npm run dev
```

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

OwnRSVP is designed to work behind reverse proxies like nginx proxy manager, nginx, Apache, or Caddy.

**Important Configuration:**
- Set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your public domain (e.g., `https://yourdomain.com`)
- Set `AUTH_TRUST_HOST=true` when behind a reverse proxy
- Ensure your reverse proxy forwards proper headers (X-Forwarded-For, X-Forwarded-Proto, etc.)

See [docs/reverse-proxy.md](docs/reverse-proxy.md) for detailed configuration examples including:
- nginx Proxy Manager setup
- Direct nginx configuration
- Apache configuration
- Caddy configuration
- Docker networking with reverse proxies
- Common issues and solutions

## SMS Configuration (Optional)

SMS notifications are powered by Twilio. To enable SMS:

1. Create a [Twilio account](https://www.twilio.com/try-twilio)
2. Get your Account SID and Auth Token from the Twilio Console
3. Get a phone number capable of sending SMS

Add these to your `.env`:

```env
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_PHONE_NUMBER="+15551234567"
```

### Features

When SMS is configured, you can:
- **Add phone numbers** when inviting guests
- **Send SMS invitations** alongside email invitations
- **Receive SMS confirmations** when guests RSVP
- **Send SMS reminders** to guests who haven't responded

### Phone Number Format

Phone numbers should include the country code:
- US/Canada: `+1 (555) 123-4567` or `+15551234567`
- UK: `+44 7911 123456`
- International: Include the `+` and country code

> **Note**: SMS is optional. The app works perfectly without Twilio configured—it will skip SMS and only send emails.

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

## Production Deployment

### Reverse Proxy Setup

OwnRSVP works behind reverse proxies (nginx, Apache, Caddy, etc.).

**Important settings:**
- Set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your public domain
- Set `AUTH_TRUST_HOST="true"` in `.env`
- Configure proxy to forward proper headers

**📖 See [docs/reverse-proxy.md](docs/reverse-proxy.md) for detailed configuration examples**

### Security Checklist

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

**📖 See [DEPLOYMENT.md](DEPLOYMENT.md#production-considerations) for production best practices**

## Troubleshooting

### Quick Diagnostics

**Check service status:**
```bash
docker compose ps
```

**View logs:**
```bash
docker compose logs -f          # All services
docker compose logs app          # Application only
docker compose logs db           # Database only
docker compose logs migrate      # Migrations
```

**Test health endpoint:**
```bash
curl http://localhost:3000/api/health
```

### Common Issues

#### Services Won't Start

**Symptoms:** Containers exit immediately or won't start

**Solutions:**
- Check logs: `docker compose logs`
- Verify environment variables are set correctly
- Check for port conflicts: `lsof -i :3000`
- Ensure Docker has enough resources allocated

#### Database Connection Errors

**Symptoms:** "Can't reach database" or connection timeout

**Solutions:**
```bash
# Verify database is running
docker compose ps db

# Check database health
docker compose exec db pg_isready -U postgres

# Restart database
docker compose restart db
```

#### Migration Errors

**Symptoms:** Migrations fail or app won't start after migrations

**Solutions:**
```bash
# Check migration logs
docker compose logs migrate

# Manually run migrations
docker compose run --rm migrate

# Reset database (WARNING: Deletes all data)
docker compose down -v
docker compose up -d
```

#### Application Won't Start

**Symptoms:** App container exits or health check fails

**Solutions:**
- Check logs: `docker compose logs app`
- Verify all required environment variables are set
- Test health endpoint: `curl http://localhost:3000/api/health`
- Check for missing SMTP configuration
- Restart: `docker compose restart app`

#### Email Not Sending

**Symptoms:** Invitations/notifications not received

**Solutions:**
1. Verify SMTP credentials in `.env` or admin panel
2. Test email in admin panel (Admin → Configuration → Test Email)
3. Check email logs: `docker compose logs app | grep -i email`
4. **Gmail users:** Ensure you're using an App Password, not your regular password
5. **SendGrid users:** Use `"apikey"` as SMTP_USER

#### Port Already in Use

**Symptoms:** "Port 3000 is already allocated"

**Solutions:**
- Change port in `docker-compose.yml`:
  ```yaml
  ports:
    - "3001:3000"  # Use different port
  ```
- Or stop the conflicting service:
  ```bash
  lsof -i :3000
  # Stop the process using the port
  ```

#### Health Check Failing

**Symptoms:** App shows as unhealthy in `docker compose ps`

**Solutions:**
- Check application logs: `docker compose logs app`
- Verify app is listening: `curl http://localhost:3000/api/health`
- Check database connection is working
- Increase health check timeout in `docker-compose.yml` if needed

### Getting More Help

- **Detailed troubleshooting:** See [DEPLOYMENT.md](DEPLOYMENT.md#troubleshooting)
- **Check logs:** Always start with `docker compose logs`
- **Verify configuration:** Ensure `.env` file is correct
- **Test components:** Use health endpoint and admin panel test features

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

