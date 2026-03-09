# ── Stage 1: Install dependencies ────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ── Stage 2: Build ───────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# better-sqlite3 needs build tools for native addon
RUN apk add --no-cache python3 make g++
RUN npm rebuild better-sqlite3

# Ensure data directory exists for build-time schema push
RUN mkdir -p data

# Push schema to temporary build DB so Drizzle generates correct queries
# Then delete the DB completely — build workers will each recreate it fresh.
# This avoids SQLITE_BUSY when multiple workers try to open the same file.
RUN npx drizzle-kit push 2>/dev/null || true
RUN rm -f data/fuehrerscheinkontrolle.db data/fuehrerscheinkontrolle.db-wal data/fuehrerscheinkontrolle.db-shm

RUN npm run build
RUN npm run postbuild

# ── Stage 3: Production ─────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/node_modules/drizzle-kit ./node_modules/drizzle-kit
COPY --from=builder /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PROJECT_ROOT=/app
ENV DATABASE_PATH=/app/data/fuehrerscheinkontrolle.db

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:3000/fk').then(r=>{process.exit(r.ok||r.status===307||r.status===308?0:1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
