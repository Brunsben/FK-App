import { db } from "./index";
import { sql } from "drizzle-orm";

/**
 * Run database migrations (create tables if they don't exist).
 * Uses Drizzle's push approach for simplicity on SQLite.
 */
export function migrateDatabase() {
  // Create tables using raw SQL for SQLite
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      date_of_birth TEXT,
      phone TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      consent_given INTEGER NOT NULL DEFAULT 0,
      must_change_password INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS license_classes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      is_expiring INTEGER NOT NULL DEFAULT 0,
      default_check_interval_months INTEGER NOT NULL DEFAULT 6,
      default_validity_years INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS member_licenses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      license_class_id TEXT NOT NULL REFERENCES license_classes(id),
      issue_date TEXT,
      expiry_date TEXT,
      check_interval_months INTEGER NOT NULL DEFAULT 6,
      notes TEXT,
      restriction_188 INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS license_checks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      checked_by_user_id TEXT REFERENCES users(id),
      check_date TEXT NOT NULL,
      check_type TEXT NOT NULL,
      result TEXT NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      next_check_due TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      check_id TEXT NOT NULL REFERENCES license_checks(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER,
      side TEXT NOT NULL,
      auto_delete_after TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS consent_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      consent_type TEXT NOT NULL,
      given INTEGER NOT NULL DEFAULT 0,
      given_at TEXT,
      withdrawn_at TEXT,
      policy_version TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'web_form',
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS notifications_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      subject TEXT,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ];

  for (const stmt of statements) {
    db.run(sql.raw(stmt));
  }

  // Create indexes
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_member_licenses_user_id ON member_licenses(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_license_checks_user_id ON license_checks(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_license_checks_next_due ON license_checks(next_check_due)`,
    `CREATE INDEX IF NOT EXISTS idx_uploaded_files_check_id ON uploaded_files(check_id)`,
    `CREATE INDEX IF NOT EXISTS idx_uploaded_files_auto_delete ON uploaded_files(auto_delete_after)`,
    `CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON consent_records(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)`,
  ];

  for (const idx of indexes) {
    db.run(sql.raw(idx));
  }
}
