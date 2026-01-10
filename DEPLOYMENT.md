# Deployment Guide

This guide provides comprehensive instructions for deploying OwnRSVP using Docker Compose.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Environment Configuration](#environment-configuration)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)
- [Production Considerations](#production-considerations)

## Prerequisites

Before you begin, ensure you have:

- **Docker** version 20.10 or higher
- **Docker Compose** version 2.0 or higher
- **SMTP credentials** for sending emails (Gmail, SendGrid, Mailgun, etc.)
- **Domain name** (for production) or localhost access (for development)
- **Basic terminal/command line knowledge**

### Verify Prerequisites

```bash
# Check Docker version
docker --version

# Check Docker Compose version
docker compose version
```

## Quick Start

For a quick deployment, follow these steps:

1. **Clone or download the repository**
   ```bash
   cd rsvp-app
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file** with your configuration (see [Environment Configuration](#environment-configuration))

4. **Start the application**
   ```bash
   docker compose up -d
   ```

5. **Wait for services to start** (30-60 seconds on first run)

6. **Access the application** at `http://localhost:3000`

7. **Create your account** at `http://localhost:3000/register`

For detailed instructions, continue reading below.

## Detailed Setup

### Step 1: Prepare the Environment

1. Navigate to the project directory:
   ```bash
   cd rsvp-app
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Open `.env` in your preferred text editor.

### Step 2: Configure Environment Variables

Edit the `.env` file with your settings. See [Environment Configuration](#environment-configuration) for detailed information about each variable.

**Minimum required configuration:**
- `AUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `AUTH_URL` - Your application URL
- `NEXT_PUBLIC_APP_URL` - Same as AUTH_URL
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` - Email configuration

### Step 3: Start the Services

Start all services in detached mode:
```bash
docker compose up -d
```

This command will:
1. Start the PostgreSQL database
2. Run database migrations
3. Start the application server

### Step 4: Monitor Startup

Watch the logs to ensure everything starts correctly:
```bash
docker compose logs -f
```

You should see:
- Database starting and becoming healthy
- Migration service running and completing
- Application starting and becoming healthy

Press `Ctrl+C` to exit log viewing.

### Step 5: Verify Services

Check that all services are running:
```bash
docker compose ps
```

Expected output:
```
NAME      COMMAND                  SERVICE    STATUS
app       "node server.js"         app        running (healthy)
db        "docker-entrypoint.s…"  db         running (healthy)
migrate   "sh -c npx prisma..."   migrate    exited (0)
```

### Step 6: Verify Application Health

Test the health endpoint:
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{"status":"ok"}
```

### Step 7: Access the Application

Open your browser and navigate to:
- **Application**: `http://localhost:3000`
- **Registration**: `http://localhost:3000/register`

## Environment Configuration

### Authentication Variables

#### AUTH_SECRET (Required)
Secret key for encrypting sessions and cookies.

**Generate a secure secret:**
```bash
openssl rand -base64 32
```

**Example:**
```env
AUTH_SECRET="xK9mP2qR7vT4wY8zA1bC3dE5fG6hI0j"
```

#### AUTH_URL (Required)
Your application's public URL. This is critical for authentication callbacks.

**For local development:**
```env
AUTH_URL="http://localhost:3000"
```

**For production:**
```env
AUTH_URL="https://your-domain.com"
```

#### NEXT_PUBLIC_APP_URL (Required)
Same as AUTH_URL. Used for generating links in emails and notifications.

```env
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

#### AUTH_TRUST_HOST (Optional)
Set to `"true"` when behind a reverse proxy (nginx, Apache, etc.).

```env
AUTH_TRUST_HOST="true"
```

### Database Variables

#### DATABASE_URL (Auto-configured)
Automatically configured for Docker Compose. Only change if using external database.

**Docker (default):**
```env
DATABASE_URL="postgresql://postgres:postgres@db:5432/rsvp_db?schema=public"
```

**External database:**
```env
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
```

#### POSTGRES_PASSWORD (Optional)
Database password. Defaults to `"postgres"` if not set.

**Change for production:**
```env
POSTGRES_PASSWORD="your-secure-password-here"
```

### Email Configuration (Required)

Email is required for sending invitations and notifications.

#### Gmail Setup

1. Enable 2-Factor Authentication on your Google account
2. Go to [Google Account → Security → App Passwords](https://myaccount.google.com/apppasswords)
3. Generate an app password for "Mail"

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-16-char-app-password"
SMTP_FROM="Events <noreply@your-domain.com>"
```

#### SendGrid Setup

```env
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASSWORD="your-sendgrid-api-key"
SMTP_FROM="Events <noreply@your-domain.com>"
```

#### Mailgun Setup

```env
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT="587"
SMTP_USER="postmaster@your-domain.mailgun.org"
SMTP_PASSWORD="your-mailgun-password"
SMTP_FROM="Events <noreply@your-domain.com>"
```

### SMS Configuration (Optional)

SMS is optional. The app works perfectly without it.

#### Twilio Setup

1. Create account at [Twilio](https://www.twilio.com/try-twilio)
2. Get Account SID and Auth Token from console
3. Get a phone number capable of sending SMS

```env
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_PHONE_NUMBER="+15551234567"
```

### Cron Configuration (Optional)

#### CRON_SECRET (Optional)
Secret for protecting the reminder cron endpoint.

**Generate:**
```bash
openssl rand -base64 32
```

**If set**, external cron services must include:
```
Authorization: Bearer <CRON_SECRET>
```

**If not set**, the endpoint is unprotected (not recommended for production).

## Post-Deployment

### Create Your First Account

1. Navigate to `http://localhost:3000/register`
2. Fill in your details:
   - Name
   - Email
   - Username
   - Password
3. Click "Register"
4. You'll be logged in automatically

### Create an Admin User

The first user you create will have regular USER role. To create an admin:

**Option 1: Database Update**
```bash
docker compose exec db psql -U postgres -d rsvp_db -c "UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'your-email@example.com';"
```

**Option 2: Admin Panel**
- Log in as an existing admin user
- Go to Admin → Users
- Edit the user and change role to ADMIN

### Configure Email (Alternative Method)

You can also configure email through the admin panel:

1. Log in as admin
2. Go to Admin → Configuration
3. Enter SMTP settings
4. Click "Save"
5. Test email configuration

### Set Up Automated Reminders

1. **Get a cron service** (e.g., [cron-job.org](https://cron-job.org), [EasyCron](https://www.easycron.com))

2. **Create a cron job** that calls:
   ```
   POST https://your-domain.com/api/cron/reminders
   Authorization: Bearer <CRON_SECRET>
   ```

3. **Set frequency**: Daily (recommended: 9 AM)

## Troubleshooting

### Services Won't Start

**Check logs:**
```bash
docker compose logs
```

**Check specific service:**
```bash
docker compose logs app
docker compose logs db
docker compose logs migrate
```

### Database Connection Errors

**Verify database is running:**
```bash
docker compose ps db
```

**Check database health:**
```bash
docker compose exec db pg_isready -U postgres
```

**Restart database:**
```bash
docker compose restart db
```

### Migration Errors

**Check migration logs:**
```bash
docker compose logs migrate
```

**Manually run migrations:**
```bash
docker compose run --rm migrate
```

**Reset database (WARNING: Deletes all data):**
```bash
docker compose down -v
docker compose up -d
```

### Application Won't Start

**Check application logs:**
```bash
docker compose logs app
```

**Common issues:**
- Missing environment variables
- Invalid SMTP credentials
- Port 3000 already in use

**Check health endpoint:**
```bash
curl http://localhost:3000/api/health
```

**Restart application:**
```bash
docker compose restart app
```

### Port Already in Use

If port 3000 is already in use:

**Option 1: Change port in docker-compose.yml**
```yaml
ports:
  - "3001:3000"  # Change 3001 to your preferred port
```

**Option 2: Stop conflicting service**
```bash
# Find what's using port 3000
lsof -i :3000

# Stop the service
```

### Email Not Sending

**Verify SMTP configuration:**
1. Check `.env` file has correct SMTP settings
2. Or check admin panel configuration

**Test email:**
1. Go to Admin → Configuration
2. Click "Test Email"
3. Check logs for errors

**Common issues:**
- Gmail: Need app password, not regular password
- SendGrid: Use "apikey" as username
- Firewall blocking SMTP port

### Health Check Failing

**Check application is running:**
```bash
docker compose ps app
```

**Check health endpoint manually:**
```bash
curl http://localhost:3000/api/health
```

**Check application logs:**
```bash
docker compose logs app | tail -50
```

### Data Not Persisting

**Verify volumes are mounted:**
```bash
docker compose ps
docker volume ls | grep rsvp
```

**Check volume data:**
```bash
docker volume inspect rsvp-app_postgres_data
```

**Restart services:**
```bash
docker compose restart
```

### Can't Access Application

**Check services are running:**
```bash
docker compose ps
```

**Check port is accessible:**
```bash
curl http://localhost:3000
```

**Check firewall:**
- Ensure port 3000 is open
- Check if reverse proxy is configured correctly

## Production Considerations

### Security

1. **Change default passwords:**
   - `POSTGRES_PASSWORD` - Use a strong password
   - `AUTH_SECRET` - Use a strong, randomly generated secret

2. **Use HTTPS:**
   - Set up SSL/TLS certificate (Let's Encrypt recommended)
   - Configure reverse proxy with SSL

3. **Protect cron endpoint:**
   - Set `CRON_SECRET` environment variable
   - Use it in your cron service configuration

4. **Regular backups:**
   - Backup PostgreSQL database regularly
   - Store backups securely

### Reverse Proxy Setup

OwnRSVP is designed to work behind reverse proxies. See [docs/reverse-proxy.md](docs/reverse-proxy.md) for detailed configuration.

**Important settings:**
- Set `AUTH_URL` to your public domain
- Set `AUTH_TRUST_HOST="true"`
- Configure proxy to forward proper headers

### Database Backups

**Manual backup:**
```bash
docker compose exec db pg_dump -U postgres rsvp_db > backup.sql
```

**Restore backup:**
```bash
docker compose exec -T db psql -U postgres rsvp_db < backup.sql
```

**Automated backups:**
Set up a cron job to run backups regularly.

### Monitoring

**Check service status:**
```bash
docker compose ps
```

**Monitor logs:**
```bash
docker compose logs -f
```

**Resource usage:**
```bash
docker stats
```

### Updates

**Pull latest changes:**
```bash
git pull
```

**Rebuild and restart:**
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Note:** Database migrations run automatically on startup.

### Scaling

For high-traffic deployments, consider:
- Using external PostgreSQL database
- Adding load balancer
- Using container orchestration (Kubernetes, Docker Swarm)

## Getting Help

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review application logs: `docker compose logs`
3. Check [GitHub Issues](https://github.com/your-repo/issues)
4. Review [README.md](README.md) for additional information

## Next Steps

After successful deployment:

1. Create your admin account
2. Configure email settings
3. Create your first event
4. Invite guests
5. Set up automated reminders (optional)
6. Configure reverse proxy for production (if needed)

Enjoy using OwnRSVP!

