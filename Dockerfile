# ── Stage 1: Install dependencies ────────────────────────
FROM node:25-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: Build ───────────────────────────────────────
FROM node:25-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build
RUN npm run postbuild

# ── Stage 3: Production ─────────────────────────────────
FROM node:25-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Upload-Verzeichnis für verschlüsselte Dateien
RUN mkdir -p /app/data/uploads && chown -R nextjs:nodejs /app/data

USER nextjs

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:3000/fk').then(r=>{process.exit(r.ok||r.status===307||r.status===308?0:1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
