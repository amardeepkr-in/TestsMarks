FROM node:20-alpine AS base

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# ---- Dependencies ----
FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Build ----
FROM base AS builder

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Enable standalone output for smaller production image
ENV NEXT_TELEMETRY_DISABLED=1
ENV SENTRY_DISABLE_SOURCE_UPLOAD=true

RUN npm run build

# ---- Production ----
FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Create data directories for SQLite persistence
# Railway will mount a volume at /app/data
RUN mkdir -p /app/data /app/public/uploads && chown -R nextjs:nodejs /app/data /app/public/uploads

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
