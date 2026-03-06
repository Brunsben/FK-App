# ─────────────────────────────────────────────────────────────────────────────
# Führerscheinkontrolle — Multi-Stage Dockerfile (Next.js 16 Standalone)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Dependencies ───────────────────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: Build ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-Time Env-Vars (werden in den standalone Output eingebettet)
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy-DB-URL für Build (wird zur Laufzeit durch echte ersetzt)
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
# Base-Path für Reverse-Proxy Deployment unter /fk/
ENV BASE_PATH=/fk

# next build erzeugt .next/standalone mit eingebettetem Server
RUN npm run build

# ── Stage 3: Runner ─────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV BASE_PATH=/fk

# Sicherheit: Nicht als root laufen
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

# Standalone-Output + statische Dateien kopieren
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Upload-Verzeichnis mit korrekten Rechten
RUN mkdir -p /app/data/uploads && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

CMD ["node", "server.js"]
