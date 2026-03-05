import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { hashSync } from "bcryptjs";
import { v4 as uuid } from "uuid";
import * as schema from "../src/lib/db/schema";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd(), "data", "fuehrerscheinkontrolle.db");
console.log(`📀 DB-Pfad: ${DB_PATH}`);

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Ensure uploads directory exists
const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

console.log(`📁 Datenbank-Pfad: ${DB_PATH}`);

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });

// ============================================================================
// Create Tables
// ============================================================================
console.log("🔨 Erstelle Tabellen...");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
    date_of_birth TEXT,
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    consent_given INTEGER NOT NULL DEFAULT 0,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS license_classes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_expiring INTEGER NOT NULL DEFAULT 0,
    default_check_interval_months INTEGER NOT NULL DEFAULT 6,
    default_validity_years INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS member_licenses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    license_class_id TEXT NOT NULL REFERENCES license_classes(id),
    issue_date TEXT,
    expiry_date TEXT,
    check_interval_months INTEGER NOT NULL DEFAULT 6,
    notes TEXT,
    restriction_188 INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS license_checks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checked_by_user_id TEXT REFERENCES users(id),
    check_date TEXT NOT NULL,
    check_type TEXT NOT NULL CHECK(check_type IN ('photo_upload', 'in_person')),
    result TEXT NOT NULL DEFAULT 'pending' CHECK(result IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    next_check_due TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS uploaded_files (
    id TEXT PRIMARY KEY,
    check_id TEXT NOT NULL REFERENCES license_checks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER,
    side TEXT NOT NULL CHECK(side IN ('front', 'back')),
    auto_delete_after TEXT,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS consent_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL CHECK(consent_type IN ('data_processing', 'email_notifications', 'photo_upload')),
    given INTEGER NOT NULL DEFAULT 0,
    given_at TEXT,
    withdrawn_at TEXT,
    policy_version TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'web_form',
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    subject TEXT,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('sent', 'failed', 'pending')),
    error_message TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

console.log("✅ Tabellen erstellt");

// ============================================================================
// Seed License Classes
// ============================================================================
console.log("🚗 Erstelle Führerscheinklassen...");

const licenseClassesSeed = [
  { id: uuid(), code: "AM", name: "Klasse AM", description: "Kleinkrafträder, Fahrräder mit Hilfsmotor", isExpiring: false, defaultCheckIntervalMonths: 6, defaultValidityYears: null, sortOrder: 1 },
  { id: uuid(), code: "A1", name: "Klasse A1", description: "Leichtkrafträder bis 125 cm³", isExpiring: false, defaultCheckIntervalMonths: 6, defaultValidityYears: null, sortOrder: 2 },
  { id: uuid(), code: "A2", name: "Klasse A2", description: "Krafträder bis 35 kW", isExpiring: false, defaultCheckIntervalMonths: 6, defaultValidityYears: null, sortOrder: 3 },
  { id: uuid(), code: "A", name: "Klasse A", description: "Krafträder ohne Leistungsbegrenzung", isExpiring: false, defaultCheckIntervalMonths: 6, defaultValidityYears: null, sortOrder: 4 },
  { id: uuid(), code: "B", name: "Klasse B", description: "Kfz bis 3.500 kg, bis 8 Personen + Fahrer", isExpiring: false, defaultCheckIntervalMonths: 6, defaultValidityYears: null, sortOrder: 5 },
  { id: uuid(), code: "BE", name: "Klasse BE", description: "B + Anhänger > 750 kg", isExpiring: false, defaultCheckIntervalMonths: 6, defaultValidityYears: null, sortOrder: 6 },
  { id: uuid(), code: "C1", name: "Klasse C1", description: "Kfz 3.500–7.500 kg", isExpiring: true, defaultCheckIntervalMonths: 6, defaultValidityYears: 5, sortOrder: 7 },
  { id: uuid(), code: "C1E", name: "Klasse C1E", description: "C1 + Anhänger > 750 kg", isExpiring: true, defaultCheckIntervalMonths: 6, defaultValidityYears: 5, sortOrder: 8 },
  { id: uuid(), code: "C", name: "Klasse C", description: "Kfz über 3.500 kg (unbegrenzt)", isExpiring: true, defaultCheckIntervalMonths: 6, defaultValidityYears: 5, sortOrder: 9 },
  { id: uuid(), code: "CE", name: "Klasse CE", description: "C + Anhänger > 750 kg", isExpiring: true, defaultCheckIntervalMonths: 6, defaultValidityYears: 5, sortOrder: 10 },
  { id: uuid(), code: "L", name: "Klasse L", description: "Land-/forstwirtschaftliche Zugmaschinen bis 40 km/h", isExpiring: false, defaultCheckIntervalMonths: 6, defaultValidityYears: null, sortOrder: 11 },
  { id: uuid(), code: "T", name: "Klasse T", description: "Land-/forstwirtschaftliche Zugmaschinen bis 60 km/h", isExpiring: false, defaultCheckIntervalMonths: 6, defaultValidityYears: null, sortOrder: 12 },
  { id: uuid(), code: "3_ALT", name: "Klasse 3 (alt)", description: "Alt-Führerschein vor 1999: Entspricht B, BE, C1, C1E + CE beschränkt (befristet bis 50. Lebensjahr)", isExpiring: true, defaultCheckIntervalMonths: 6, defaultValidityYears: null, sortOrder: 13 },
  { id: uuid(), code: "FF", name: "Feuerwehrführerschein (Nds.)", description: "Sonderfahrberechtigung gem. §2 Abs. 16 StVG / Nds. – Erlaubt Feuerwehrangehörigen mit Klasse B das Führen von Einsatzfahrzeugen bis 4,75t (bzw. 7,5t mit Einweisung)", isExpiring: false, defaultCheckIntervalMonths: 0, defaultValidityYears: null, sortOrder: 14 },
];

for (const lc of licenseClassesSeed) {
  const existing = sqlite.prepare("SELECT id FROM license_classes WHERE code = ?").get(lc.code);
  if (!existing) {
    db.insert(schema.licenseClasses).values(lc).run();
  }
}

console.log("✅ Führerscheinklassen erstellt");

// ============================================================================
// Seed Admin User
// ============================================================================
console.log("👤 Erstelle Admin-Benutzer...");

const adminEmail = process.argv[2] || "admin@feuerwehr.de";
const adminPassword = process.argv[3] || "admin123";
const adminName = process.argv[4] || "Ortsbrandmeister";

const existingAdmin = sqlite.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
if (!existingAdmin) {
  const adminId = uuid();
  db.insert(schema.users).values({
    id: adminId,
    email: adminEmail.toLowerCase().trim(),
    passwordHash: hashSync(adminPassword, 12),
    name: adminName,
    role: "admin",
    isActive: true,
    consentGiven: false,
    mustChangePassword: true,
  }).run();
  console.log(`✅ Admin erstellt: ${adminEmail} / ${adminPassword}`);
  console.log("⚠️  Bitte Passwort nach dem ersten Login ändern!");
} else {
  console.log("ℹ️  Admin existiert bereits");
}

// ============================================================================
// Seed Default Settings
// ============================================================================
const defaultSettings = [
  { key: "check_interval_months", value: "6" },
  { key: "reminder_weeks_before", value: "4" },
  { key: "reminder_weeks_before_2", value: "1" },
  { key: "license_expiry_warning_months", value: "3" },
  { key: "photo_auto_delete_days", value: "30" },
  { key: "privacy_policy_version", value: "1.0" },
  { key: "fire_department_name", value: "Freiwillige Feuerwehr" },
];

for (const s of defaultSettings) {
  const existing = sqlite.prepare("SELECT key FROM app_settings WHERE key = ?").get(s.key);
  if (!existing) {
    db.insert(schema.appSettings).values(s).run();
  }
}

console.log("✅ Standard-Einstellungen gesetzt");

// ============================================================================
// Done
// ============================================================================
sqlite.close();

console.log("\n🎉 Setup abgeschlossen!");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`📧 Admin-Login: ${adminEmail}`);
console.log(`🔑 Admin-Passwort: ${adminPassword}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("\nStarte die App mit: npm run dev");
