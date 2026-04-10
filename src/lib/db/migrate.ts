import { db } from "./index";
import { sql } from "drizzle-orm";

/**
 * Run database migrations (create schema + indexes).
 * Tables are created by `drizzle-kit push`. This creates the schema
 * and any indexes that Drizzle doesn't manage.
 */
export async function migrateDatabase() {
  // Schema wird von drizzle-kit push erstellt, hier nur Indexes
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS fw_fuehrerschein`);

  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_member_licenses_user_id ON fw_fuehrerschein.member_licenses(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_license_checks_user_id ON fw_fuehrerschein.license_checks(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_license_checks_next_due ON fw_fuehrerschein.license_checks(next_check_due)`,
    `CREATE INDEX IF NOT EXISTS idx_uploaded_files_check_id ON fw_fuehrerschein.uploaded_files(check_id)`,
    `CREATE INDEX IF NOT EXISTS idx_uploaded_files_auto_delete ON fw_fuehrerschein.uploaded_files(auto_delete_after)`,
    `CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON fw_fuehrerschein.consent_records(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON fw_fuehrerschein.audit_log(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON fw_fuehrerschein.audit_log(created_at)`,
  ];

  for (const idx of indexes) {
    await db.execute(sql.raw(idx));
  }
}
