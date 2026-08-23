/**
 * Migration: SQLite → PostgreSQL
 * Liest die bestehende SQLite-DB und schreibt alle Daten nach PostgreSQL.
 *
 * Voraussetzungen:
 *   1. PostgreSQL-Schema `fw_fuehrerschein` existiert:
 *      CREATE SCHEMA IF NOT EXISTS fw_fuehrerschein;
 *   2. Drizzle-Tabellen sind erstellt:
 *      DATABASE_URL=... npx drizzle-kit push
 *   3. DATABASE_URL und DATABASE_PATH (SQLite-Pfad) sind gesetzt.
 *
 * Ausführen:
 *   DATABASE_URL=postgresql://... DATABASE_PATH=./data/fuehrerscheinkontrolle.db npx tsx scripts/migrate-sqlite-to-pg.ts
 */

import Database from "better-sqlite3";
import postgres from "postgres";

const SQLITE_PATH =
  process.env.DATABASE_PATH || "./data/fuehrerscheinkontrolle.db";
const PG_URL = process.env.DATABASE_URL;

if (!PG_URL) {
  console.error("❌ DATABASE_URL nicht gesetzt");
  process.exit(1);
}

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const pg = postgres(PG_URL);

const SCHEMA = "fw_fuehrerschein";

async function migrate() {
  console.log(`📀 SQLite: ${SQLITE_PATH}`);
  console.log(`🐘 PostgreSQL: ${PG_URL?.replace(/:[^@]+@/, ":***@")}`);
  console.log();

  // Tabellen in Reihenfolge (FK-Abhängigkeiten beachten)
  const tables = [
    "users",
    "license_classes",
    "member_licenses",
    "license_checks",
    "uploaded_files",
    "consent_records",
    "notifications_log",
    "audit_log",
    "app_settings",
  ];

  // Boolean-Spalten (SQLite: 0/1 → PG: true/false)
  const boolCols: Record<string, string[]> = {
    users: ["is_active", "consent_given", "must_change_password"],
    license_classes: ["is_expiring"],
    member_licenses: ["restriction_188"],
    consent_records: ["given"],
  };

  for (const table of tables) {
    const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<
      string,
      unknown
    >[];
    if (rows.length === 0) {
      console.log(`  ⏭️  ${table}: leer`);
      continue;
    }

    // Boolean-Spalten konvertieren
    const bools = boolCols[table] || [];
    for (const row of rows) {
      for (const col of bools) {
        if (col in row) {
          row[col] = row[col] === 1 || row[col] === true;
        }
      }
    }

    const cols = Object.keys(rows[0]);
    const colList = cols.map((c) => `"${c}"`).join(", ");
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");

    // Batch-Insert mit ON CONFLICT DO NOTHING
    let inserted = 0;
    for (const row of rows) {
      const values = cols.map((c) => row[c] ?? null);
      try {
        await pg.unsafe(
          `INSERT INTO "${SCHEMA}"."${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values as any[],
        );
        inserted++;
      } catch (err: unknown) {
        console.error(`  ❌ ${table}: Fehler bei Zeile`, row, err);
      }
    }
    console.log(`  ✅ ${table}: ${inserted}/${rows.length} Zeilen migriert`);
  }

  console.log("\n🎉 Migration abgeschlossen!");
  await pg.end();
  sqlite.close();
}

migrate().catch((err) => {
  console.error("❌ Migration fehlgeschlagen:", err);
  process.exit(1);
});
