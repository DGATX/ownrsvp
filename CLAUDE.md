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

# Database (IMPORTANT: Always use migrations!)
npm run db:migrate       # Create and apply migrations (USE THIS for schema changes)
npm run db:studio        # Open Prisma Studio GUI
npm run db:seed          # Seed database with demo data
# npm run db:push        # DO NOT USE - breaks existing user databases

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

## Database Migration Workflow (CRITICAL)

**NEVER use `prisma db push` for schema changes.** This command updates your local dev database directly without creating migration files, which breaks existing user databases when they upgrade.

### When Modifying `schema.prisma`:

1. **Make your schema changes** in `prisma/schema.prisma`

2. **Create a migration** (this generates SQL and applies it to dev.db):
   ```bash
   npx prisma migrate dev --name descriptive_name
   # Example: npx prisma migrate dev --name add_address_fields
   ```

3. **Review the generated migration** in `prisma/migrations/[timestamp]_[name]/migration.sql`

4. **Test the migration** by resetting and re-applying:
   ```bash
   # Optional: test migration from scratch
   rm prisma/dev.db
   npx prisma migrate dev
   ```

5. **Commit both** the schema.prisma AND the new migration folder

### Why This Matters

- Docker images include the `prisma/migrations/` folder
- On container start, `prisma migrate deploy` runs pending migrations
- If schema changes aren't in a migration file, existing user databases won't be updated
- This causes "column does not exist" errors for users upgrading from older versions

### Migration File Naming

Use descriptive names that explain the change:
- `add_address_fields` - Adding new columns
- `add_user_preferences` - New feature columns
- `rename_location_to_venue` - Column renames
- `add_guest_dietary_index` - Adding indexes

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

## The Printed Invitation — Design System

OwnRSVP uses a **Letterpress Editorial** design system: ink on warm paper, evoking a boutique invitation press. All UI changes (components, pages, AND email templates) MUST adhere to it. The aesthetic is deliberately distinctive and characterful — not generic SaaS.

### Identity
- **Concept**: a printed invitation / event poster — confident typography, hairline rules, rubber-stamp accents, paper grain.
- **One dominant accent** (vermilion) + one secondary (ochre) on warm paper/ink neutrals. NO rainbow gradients.
- Light mode = ivory **Paper**; dark mode = warm near-black **Ink**.

### Core Color Palette (HSL tokens in `globals.css`)

| Role | Token | Light (Paper) | Dark (Ink) | Usage |
|------|-------|---------------|-----------|-------|
| Primary (Vermilion) | `--primary` | `10 80% 47%` (#d6371c) | `12 88% 58%` | Primary actions, links, emphasis, stamps |
| Accent (Ochre) | `--accent` | `36 74% 42%` (#bd811c) | `38 78% 56%` | Secondary emphasis, "maybe", info/warnings |
| Foreground (Ink) | `--foreground` | `28 18% 12%` | `38 40% 90%` | Body text; "not attending" status |
| Background (Paper) | `--background` | `38 44% 92%` | `32 22% 7%` | Page background |
| Card | `--card` | `40 46% 96%` | `30 20% 10%` | Card surfaces |
| Muted | `--muted` | `38 30% 86%` | `30 14% 16%` | Subtle fills, "pending" status |
| Border | `--border` | `34 22% 74%` | `32 16% 22%` | Hairline rules & borders |
| Destructive | `--destructive` | `0 72% 42%` | `2 70% 52%` | Delete / danger only |

**Always use semantic tokens** (`bg-primary`, `text-accent`, `border-border`, `bg-muted`, …). NEVER hardcode Tailwind palette colors (`violet-500`, `green-600`, `slate-900`, gradients, etc.).

### Typography
- **Display (headlines)**: `Fraunces` — editorial serif. Use `font-display`; auto-applied to `h1`–`h6` and `CardTitle`.
- **Body**: `Hanken Grotesk` — `font-sans` (default).
- **Metadata / labels**: `Spline Sans Mono` — `font-mono`; use `.label-mono` for uppercase tracked labels (WHEN / WHERE / RSVP BY / section kickers).
- Loaded via `next/font` in `src/app/layout.tsx` (vars `--font-display`, `--font-body`, `--font-mono`).

### Design Tokens
- **Border radius**: crisp. `--radius: 0.25rem`. Use `rounded-[3px]` / `rounded-[2px]` for letterpress sharpness. Avoid pills / `rounded-xl`.
- **Shadows**: soft ink, not neon. Cards: `0 1px 0 hsl(var(--foreground)/0.04), 0 14px 34px -22px hsl(var(--foreground)/0.35)`.
- **Borders**: 1px hairlines using `--border`.
- **Paper grain**: a faint global noise overlay (`body::after`) — do not remove.

### Letterpress Motifs (utilities in `globals.css`)
- `.label-mono` — uppercase tracked mono label.
- `.headline` — tight editorial display headline.
- `.stamp` (+ `.stamp-skew`) — outlined rubber-stamp badge (statuses, confirmations).
- `.ink-rule` / `.ink-rule-double` — hairline / double editorial dividers.
- `.perf-top` — dashed perforation edge (tear-off RSVP sections).
- `.aurora-bg` — warm paper background with faint radial tint (legacy class name, retained).
- `.card-glow` — subtle hover lift. `.glass` — frosted paper nav bar. `.gradient-text` — vermilion italic display emphasis.

**Status color convention**: Attending → `primary` (vermilion); Maybe → `accent` (ochre); Not Attending → `foreground` (ink); Pending → `muted`. (Canonical guest statuses: `PENDING`, `ATTENDING`, `NOT_ATTENDING`, `MAYBE`.)

### Email Template Guidelines (`src/lib/email.ts`)
Inline HTML; web fonts don't load in mail clients, so headings use a `Georgia, 'Times New Roman', serif` stack.
- Body background: `#f4ede0` (paper)
- Card: white, `border-radius: 3–4px`, soft ink shadow
- Headers: solid vermilion `#d6371c` block with white serif title
- Text: `#1c1813` (headings), `#374151` (body), `#4b5563` (secondary)
- Accent text / links: `#d6371c`; secondary accent `#bd811c`
- RSVP buttons: Yes = vermilion `#d6371c`, Maybe = ochre `#bd811c`, No = ink `#2f2a22`

### CSS Variables
```css
--primary: 10 80% 47%;    /* Vermilion */
--accent: 36 74% 42%;     /* Ochre */
--foreground: 28 18% 12%; /* Ink (light mode) */
--background: 38 44% 92%; /* Paper (light mode) */
```
