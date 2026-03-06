# Führerscheinkontrolle

## Architektur

Next.js 16 App mit PostgreSQL (Drizzle ORM) — Teil des Feuerwehr-Portal-Ökosystems.

### Tech-Stack
- **Frontend**: React 19, Next.js 16.1, Tailwind CSS 4, shadcn/ui, Radix UI
- **Backend**: Next.js API Routes (Server Components + Route Handlers)
- **Datenbank**: PostgreSQL 17 via `postgres.js` + Drizzle ORM
- **Auth**: NextAuth v5 (beta.30) mit Credentials-Provider
- **Verschlüsselung**: AES-256-GCM für hochgeladene Führerschein-Fotos

### Datenbank-Schema
Die App nutzt zwei PostgreSQL-Schemas:
- `fw_common` — Gemeinsame Tabellen (members, accounts, app_permissions) geteilt mit PSA + FoodBot
- `fw_fuehrerschein` — App-spezifische Tabellen (member_profiles, license_classes, member_licenses, license_checks, uploaded_files, consent_records, notifications_log, audit_log, app_settings)

### App-Berechtigungen (`fw_common.app_permissions`)
Pro Benutzer können unterschiedliche Rollen pro App vergeben werden:
- Tabelle: `(account_id, app, rolle)` mit UNIQUE auf `(account_id, app)`
- Apps: `'psa'`, `'food'`, `'fk'`
- Rollen: `'Admin'`, `'Kleiderwart'`, `'User'`
- Fallback: Wenn kein Eintrag für eine App existiert, wird `accounts."Rolle"` verwendet
- `toUserView()` liest die FK-spezifische Berechtigung über die `appPermissions`-Relation

### Middleware (`src/middleware.ts` + `src/proxy.ts`)
- `src/proxy.ts` enthält die Middleware-Logik (Route-Schutz, Admin-Check, Backup-API)
- `src/middleware.ts` re-exportiert `proxy` als `middleware` (Next.js erkennt nur diese Datei!)
- Cookie-Name: `next-auth.session-token`
- Public Routes: `/login`, `/api/auth`

### Helpers-Layer (`src/lib/db/helpers.ts`)
Abstraktionsschicht zwischen fw_common (3-Tabellen-Modell) und der App:
- `toUserView()` — Konvertiert Member+Account+Profile zu flachem View-Objekt
- `getMemberView(id)` — Einzelnes Mitglied mit optionalen Relations
- `getActiveMemberViews()` — Alle aktiven Mitglieder
- `createMember()` / `updateMember()` — CRUD über fw_common-Tabellen
- `setMemberPassword()` / `authenticateMember()` — Auth-Operationen

### Deployment
```bash
# Lokal
cp .env.example .env.local
npm install && npm run dev

# Docker (über Portal docker-compose.yml)
cd ~/Documents/portal
docker compose up -d fuehrerschein
```

### Umgebungsvariablen
Siehe `.env.example` — Wichtigste:
- `DATABASE_URL` — PostgreSQL Connection-String
- `AUTH_SECRET` — NextAuth Secret
- `ENCRYPTION_KEY` — AES-256 Key für Foto-Verschlüsselung

## Unification-Status

**Schritt 3** des 5-Schritte-Plans zur Vereinheitlichung aller Feuerwehr-Apps:
- ✅ SQLite → PostgreSQL (postgres.js + Drizzle)
- ✅ Lokale `users`-Tabelle → `fw_common.members` + `fw_common.accounts` + `fw_fuehrerschein.member_profiles`
- ✅ Alle sync `.sync()` → async `await`
- ✅ Dockerfile + Docker-Compose Service
- ✅ `basePath`-Support für `/fk/` Reverse-Proxy-Pfad
