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
docker compose up -d     # Start production stack
docker compose logs app  # View application logs

# Docker Hub (IMPORTANT: always build multi-platform)
docker buildx build --platform linux/amd64,linux/arm64 -t dgatx/ownrsvp:latest --push .
```

## Docker Multi-Platform Requirements

**CRITICAL:** All Docker images MUST be built for multiple platforms to ensure compatibility across Windows, Mac (Intel and Apple Silicon), and Linux systems.

When building Docker images, ALWAYS use the `--platform` flag with `docker buildx`:
```bash
docker buildx build --platform linux/amd64,linux/arm64 -t dgatx/ownrsvp:latest --push .
```

- `linux/amd64` - Supports Windows, Linux, and Intel Macs
- `linux/arm64` - Supports Apple Silicon Macs (M1/M2/M3) and ARM-based Linux systems

Never build single-platform images. This ensures users on any operating system can run the OwnRSVP Docker container without compatibility issues.

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
- Uses SQLite for both development (`file:./dev.db`) and Docker (`/app/data/ownrsvp.db`)
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

## Aurora Borealis Theme

All UI changes MUST adhere to the Aurora Borealis design system. This includes components, pages, and email templates.

### Core Color Palette

| Color | Hex | HSL | Usage |
|-------|-----|-----|-------|
| Cyan (Primary) | `#07c8f9` | `189 94% 43%` | Primary actions, links, focus rings |
| Purple (Secondary) | `#9d4edd` | `258 90% 66%` | Secondary actions, accents, borders |
| Pink (Accent) | `#f5267e` | `330 81% 60%` | Highlights, special emphasis |
| Amber (CTA) | `#f59e0b` | `38 92% 50%` | Call-to-action buttons, warnings |
| Dark Navy | `#0a0f2c` | `240 40% 10%` | Text in light mode, background in dark |
| Light Background | `#f5f6fb` | `240 30% 97%` | Page background (light mode) |

### Gradients

Use these standard gradient patterns:
```css
/* Primary Aurora gradient (headers, hero sections) */
background: linear-gradient(135deg, #07c8f9 0%, #9d4edd 50%, #f5267e 100%);

/* Cyan to Purple (buttons, cards) */
background: linear-gradient(135deg, #07c8f9 0%, #9d4edd 100%);

/* Purple to Pink (accents) */
background: linear-gradient(135deg, #9d4edd 0%, #f5267e 100%);

/* Amber CTA button */
background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);

/* Subtle background tint */
background: linear-gradient(180deg, #f5f6fb 0%, #fff5e6 100%);
```

### Design Tokens

- **Border Radius**: `12px` (small), `16px` (cards/modals), `1rem` (default)
- **Shadows**: Always use purple-tinted shadows
  - Cards: `box-shadow: 0 4px 24px rgba(157, 78, 221, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08);`
  - Buttons: `box-shadow: 0 4px 14px rgba(157, 78, 221, 0.3);`
- **Borders**: Use `rgba(157, 78, 221, 0.15)` for subtle borders

### Email Template Guidelines

For inline HTML email styles:
- Body background: `#f5f6fb`
- Outer table: gradient background
- Card container: white with `border-radius: 16px` and purple-tinted shadow
- Headers: Full-width aurora gradient (`#07c8f9` → `#9d4edd` → `#f5267e`)
- Text colors: `#0a0f2c` (headings), `#374151` (body), `#4b5563` (secondary)
- Accent text: `#9d4edd`
- CTA buttons: Amber gradient with `border-radius: 12px`
- Footer: Subtle gradient background, `#9d4edd` text

### Tailwind Classes

Use these custom classes from `globals.css`:
- `.aurora-bg` - Adds subtle aurora radial gradients
- `.aurora-animated` - Animated aurora background effect
- `.gradient-text` - Animated gradient text
- `.glass` - Glassmorphism card effect
- `.glow-border` - Gradient border glow on hover
- `.btn-aurora` - Primary aurora gradient button
- `.card-glow` - Card hover glow effect
- `.mesh-gradient` - Complex mesh gradient background

### CSS Variables (for Tailwind)

Access theme colors via CSS variables:
```css
--primary: 189 94% 43%;    /* Cyan */
--secondary: 258 90% 66%;  /* Purple */
--accent: 330 81% 60%;     /* Pink */
```
