# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OwnRSVP is a self-hosted event invitation and RSVP management platform built with Next.js 14 (App Router), Prisma ORM, and NextAuth.js authentication.

## Common Commands

```bash
# Development
npm run dev              # Start development server (localhost:3000)
npm run build            # Build for production (runs prisma generate first)
npm run lint             # Run ESLint

# Database
npm run db:push          # Push schema changes to database (no migrations)
npm run db:migrate       # Create and apply migrations
npm run db:studio        # Open Prisma Studio GUI
npm run db:seed          # Seed database with demo data

# Docker
docker compose up -d     # Start production stack (PostgreSQL + app)
docker compose logs app  # View application logs
```

## Architecture

### Authentication Flow
- `src/auth.ts` - NextAuth.js configuration with credentials provider (supports email or username login)
- `src/middleware.ts` - Route protection; public routes include `/`, `/login`, `/register`, `/events/*`, `/rsvp/*`, `/invite/*`
- User roles: `ADMIN` or `USER` (stored in JWT token)

### Event Access Control
- `src/lib/event-access.ts` - Permission checking for events
- Three access levels: HOST (owner), COHOST, VIEWER
- ADMINs have full access to all events
- Co-hosts can manage events but cannot delete them

### RSVP Token System
- Each guest gets a unique token (`Guest.token`) for their RSVP link
- Public RSVP flow: `/rsvp/[token]` -> guest submits response without authentication
- Guests can have additional guests (plus-ones) via `AdditionalGuest` model

### Email System
- `src/lib/email.ts` - All email sending functions (invitations, reminders, confirmations, broadcasts)
- `src/lib/config.ts` - Email config can be stored in database (`AppConfig` table) or environment variables
- Email templates are inline HTML in `email.ts`

### Database
- Uses SQLite by default (`file:./dev.db`), PostgreSQL for production
- Path alias: `@/*` maps to `./src/*`
- Key models: User, Event, Guest, AdditionalGuest, Comment, EventCoHost, AppConfig

### API Route Patterns
All API routes are in `src/app/api/`:
- Event management: `/api/events/[id]/*`
- Guest operations: `/api/events/[id]/guests/*`
- RSVP submission: `/api/rsvp` (public POST)
- Admin config: `/api/admin/config/*`
- Cron endpoint: `/api/cron/reminders` (requires CRON_SECRET header)

### Component Structure
- UI primitives in `src/components/ui/` (shadcn/ui style with Radix primitives)
- Feature components directly in `src/components/`
- Uses `class-variance-authority` for component variants
