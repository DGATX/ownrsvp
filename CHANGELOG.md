# Changelog

All notable changes to OwnRSVP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-XX

### Added
- Initial release of OwnRSVP
- Event creation and management
- Email invitations with HTML templates
- RSVP tracking (Attending, Maybe, Not Attending)
- Guest management with plus-ones
- Dietary restrictions tracking
- Guest comments/wall
- Automated reminder system
- Dynamic reminder scheduling (daily/hourly)
- Guest limit management (global and per-invitee)
- Co-host support
- Admin dashboard
- User management
- Email/SMS configuration via admin panel
- Factory reset functionality
- Bulk event deletion
- Docker Compose deployment
- Comprehensive documentation
- Public event pages with shareable links
- QR code generation for events
- Image uploads for event cover photos
- Event photo albums
- RSVP deadline enforcement
- Guest limit validation
- Resend invite link functionality
- Bulk select and actions for guests
- Past events management with bulk deletion

### Security
- Secure authentication with NextAuth.js
- Password hashing with bcrypt
- Session management
- Environment variable configuration
- Admin-only access controls

### Documentation
- Complete deployment guide (DEPLOYMENT.md)
- Quick start guide (QUICKSTART.md)
- Reverse proxy configuration examples
- Troubleshooting guide
- Gmail setup instructions
- API documentation

### Technical
- Next.js 14 with App Router
- SQLite database with Prisma ORM
- TypeScript throughout
- Tailwind CSS for styling
- Responsive design
- Dark mode support
- Docker and Docker Compose support
- Health check endpoints
- Automated database migrations

