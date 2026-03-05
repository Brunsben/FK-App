import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ============================================================================
// USERS
// ============================================================================
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // UUID
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  dateOfBirth: text("date_of_birth"), // ISO date string – needed for Klasse 3 / CE age calc
  phone: text("phone"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  consentGiven: integer("consent_given", { mode: "boolean" }).notNull().default(false),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

// ============================================================================
// LICENSE CLASSES (Führerscheinklassen)
// ============================================================================
export const licenseClasses = sqliteTable("license_classes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(), // e.g. "B", "BE", "C", "CE", "C1", "C1E", "3_ALT"
  name: text("name").notNull(), // e.g. "Klasse B", "Klasse 3 (alt)"
  description: text("description"),
  isExpiring: integer("is_expiring", { mode: "boolean" }).notNull().default(false), // C/CE = true
  defaultCheckIntervalMonths: integer("default_check_interval_months").notNull().default(6),
  defaultValidityYears: integer("default_validity_years"), // e.g. 5 for C/CE
  sortOrder: integer("sort_order").notNull().default(0),
});

// ============================================================================
// MEMBER LICENSES (Welche Klassen hat ein Mitglied?)
// ============================================================================
export const memberLicenses = sqliteTable("member_licenses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  licenseClassId: text("license_class_id").notNull().references(() => licenseClasses.id),
  issueDate: text("issue_date"), // Wann erteilt
  expiryDate: text("expiry_date"), // Wann läuft ab (null bei B/BE)
  checkIntervalMonths: integer("check_interval_months").notNull().default(6), // Override per member
  notes: text("notes"),
  restriction188: integer("restriction_188", { mode: "boolean" }).notNull().default(false), // SZ 188 Feuerwehr U21
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

// ============================================================================
// LICENSE CHECKS (Kontrollprotokoll)
// ============================================================================
export const licenseChecks = sqliteTable("license_checks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  checkedByUserId: text("checked_by_user_id").references(() => users.id),
  checkDate: text("check_date").notNull(), // ISO date
  checkType: text("check_type", { enum: ["photo_upload", "in_person"] }).notNull(),
  result: text("result", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  nextCheckDue: text("next_check_due"), // Automatically calculated
  notes: text("notes"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

// ============================================================================
// UPLOADED FILES (Führerschein-Fotos, verschlüsselt)
// ============================================================================
export const uploadedFiles = sqliteTable("uploaded_files", {
  id: text("id").primaryKey(),
  checkId: text("check_id").notNull().references(() => licenseChecks.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(), // Path to encrypted file on disk
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size"),
  side: text("side", { enum: ["front", "back"] }).notNull(), // Vorderseite / Rückseite
  autoDeleteAfter: text("auto_delete_after"), // ISO date – auto cleanup
  uploadedAt: text("uploaded_at").notNull().default("(datetime('now'))"),
});

// ============================================================================
// CONSENT RECORDS (DSGVO-Einwilligungen)
// ============================================================================
export const consentRecords = sqliteTable("consent_records", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  consentType: text("consent_type", {
    enum: ["data_processing", "email_notifications", "photo_upload"],
  }).notNull(),
  given: integer("given", { mode: "boolean" }).notNull().default(false),
  givenAt: text("given_at"),
  withdrawnAt: text("withdrawn_at"),
  policyVersion: text("policy_version").notNull(), // e.g. "1.0"
  method: text("method").notNull().default("web_form"), // How consent was given
  ipAddress: text("ip_address"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

// ============================================================================
// NOTIFICATIONS LOG
// ============================================================================
export const notificationsLog = sqliteTable("notifications_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["check_reminder_4w", "check_reminder_1w", "check_overdue", "license_expiry_3m", "license_expiry_1m", "license_expired", "admin_summary"],
  }).notNull(),
  subject: text("subject"),
  sentAt: text("sent_at").notNull().default("(datetime('now'))"),
  status: text("status", { enum: ["sent", "failed", "pending"] }).notNull().default("pending"),
  errorMessage: text("error_message"),
});

// ============================================================================
// AUDIT LOG
// ============================================================================
export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  action: text("action").notNull(), // e.g. "login", "check_approved", "member_created", "data_exported"
  entityType: text("entity_type"), // e.g. "user", "license_check"
  entityId: text("entity_id"),
  details: text("details"), // JSON string with additional info
  ipAddress: text("ip_address"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

// ============================================================================
// SETTINGS (App-Konfiguration)
// ============================================================================
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

// ============================================================================
// RELATIONS
// ============================================================================
export const usersRelations = relations(users, ({ many }) => ({
  memberLicenses: many(memberLicenses),
  licenseChecks: many(licenseChecks),
  uploadedFiles: many(uploadedFiles),
  consentRecords: many(consentRecords),
  notifications: many(notificationsLog),
}));

export const licenseClassesRelations = relations(licenseClasses, ({ many }) => ({
  memberLicenses: many(memberLicenses),
}));

export const memberLicensesRelations = relations(memberLicenses, ({ one }) => ({
  user: one(users, { fields: [memberLicenses.userId], references: [users.id] }),
  licenseClass: one(licenseClasses, { fields: [memberLicenses.licenseClassId], references: [licenseClasses.id] }),
}));

export const licenseChecksRelations = relations(licenseChecks, ({ one, many }) => ({
  user: one(users, { fields: [licenseChecks.userId], references: [users.id] }),
  checkedBy: one(users, { fields: [licenseChecks.checkedByUserId], references: [users.id] }),
  uploadedFiles: many(uploadedFiles),
}));

export const uploadedFilesRelations = relations(uploadedFiles, ({ one }) => ({
  check: one(licenseChecks, { fields: [uploadedFiles.checkId], references: [licenseChecks.id] }),
  user: one(users, { fields: [uploadedFiles.userId], references: [users.id] }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type LicenseClass = typeof licenseClasses.$inferSelect;
export type MemberLicense = typeof memberLicenses.$inferSelect;
export type LicenseCheck = typeof licenseChecks.$inferSelect;
export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type ConsentRecord = typeof consentRecords.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
