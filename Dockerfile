# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Set dummy environment variables for build (will be overridden at runtime)
ENV AUTH_SECRET="dummy-secret-for-build-only"
ENV DATABASE_URL="file:./dummy.db"

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy startup script
COPY --chown=nextjs:nodejs start.sh ./
RUN chmod +x start.sh

# Create data directory for SQLite database and secrets
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 7787

ENV PORT=7787
ENV HOSTNAME="0.0.0.0"
ENV AUTH_SECRET="auto"
ENV AUTH_TRUST_HOST="true"
ENV DATABASE_URL="file:/app/data/ownrsvp.db"

# Start the application (runs migrations then starts server)
CMD ["./start.sh"]
