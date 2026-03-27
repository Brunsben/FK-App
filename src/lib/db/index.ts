import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";
import { v4 as uuid } from "uuid";

// Database file location – MUST be absolute to survive standalone mode
function resolveDatabasePath(): string {
  // 1. Explicit env variable (highest priority, always absolute)
  if (process.env.DATABASE_PATH) {
    return path.resolve(process.env.DATABASE_PATH);
  }

  // 2. Derive from PROJECT_ROOT env (set by start scripts)
  if (process.env.PROJECT_ROOT) {
    return path.join(
      process.env.PROJECT_ROOT,
      "data",
      "fuehrerscheinkontrolle.db",
    );
  }

  // 3. Fallback: cwd (works for dev mode + seed script)
  return path.resolve(process.cwd(), "data", "fuehrerscheinkontrolle.db");
}

const DB_PATH = resolveDatabasePath();

// Log the resolved path so we can always verify
console.log(`📀 SQLite DB: ${DB_PATH}`);

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create SQLite connection with WAL mode for better performance
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Export raw sqlite for special operations (e.g. backup)
export const rawDb = sqlite;

// Auto-seed license classes if table exists but is empty
try {
  const row = sqlite
    .prepare("SELECT COUNT(*) as cnt FROM license_classes")
    .get() as { cnt: number } | undefined;
  if (row && row.cnt === 0) {
    console.log("🌱 Auto-seeding Führerscheinklassen...");
    const insert = sqlite.prepare(
      `INSERT OR IGNORE INTO license_classes
       (id, code, name, description, is_expiring, default_check_interval_months, default_validity_years, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const defaultClasses: [
      string,
      string,
      string,
      number,
      number,
      number | null,
      number,
    ][] = [
      [
        "AM",
        "Klasse AM",
        "Kleinkrafträder, Fahrräder mit Hilfsmotor",
        0,
        6,
        null,
        1,
      ],
      ["A1", "Klasse A1", "Leichtkrafträder bis 125 cm³", 0, 6, null, 2],
      ["A2", "Klasse A2", "Krafträder bis 35 kW", 0, 6, null, 3],
      ["A", "Klasse A", "Krafträder ohne Leistungsbegrenzung", 0, 6, null, 4],
      [
        "B",
        "Klasse B",
        "Kfz bis 3.500 kg, bis 8 Personen + Fahrer",
        0,
        6,
        null,
        5,
      ],
      ["BE", "Klasse BE", "B + Anhänger > 750 kg", 0, 6, null, 6],
      ["C1", "Klasse C1", "Kfz 3.500–7.500 kg", 1, 6, 5, 7],
      ["C1E", "Klasse C1E", "C1 + Anhänger > 750 kg", 1, 6, 5, 8],
      ["C", "Klasse C", "Kfz über 3.500 kg (unbegrenzt)", 1, 6, 5, 9],
      ["CE", "Klasse CE", "C + Anhänger > 750 kg", 1, 6, 5, 10],
      [
        "L",
        "Klasse L",
        "Land-/forstwirtschaftliche Zugmaschinen bis 40 km/h",
        0,
        6,
        null,
        11,
      ],
      [
        "T",
        "Klasse T",
        "Land-/forstwirtschaftliche Zugmaschinen bis 60 km/h",
        0,
        6,
        null,
        12,
      ],
      [
        "3_ALT",
        "Klasse 3 (alt)",
        "Alt-Führerschein vor 1999: B, BE, C1, C1E + CE beschränkt",
        1,
        6,
        null,
        13,
      ],
      [
        "FF",
        "Feuerwehrführerschein",
        "Sonderfahrberechtigung gem. §2 Abs. 16 StVG",
        0,
        0,
        null,
        14,
      ],
    ];
    const seedAll = sqlite.transaction(() => {
      for (const c of defaultClasses) {
        insert.run(uuid(), ...c);
      }
    });
    seedAll();
    console.log(`  ✅ ${defaultClasses.length} Führerscheinklassen angelegt`);
  }
} catch {
  // Table doesn't exist yet — will be created by migration/setup
}
