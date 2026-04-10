import { pgSchema, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const fk = pgSchema("fw_fuehrerschein");

// ============================================================================
// USERS
// ============================================================================
export const users = fk.table("users", {
  id: text("id").primaryKey(), // UUID as text (Portal kamerad_id)
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  dateOfBirth: text("date_of_birth"),
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
  consentGiven: boolean("consent_given").notNull().default(false),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
});

// ============================================================================
// LICENSE CLASSES (Führerscheinklassen)
// ============================================================================
export const licenseClasses = fk.table("license_classes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isExpiring: boolean("is_expiring").notNull().default(false),
  defaultCheckIntervalMonths: integer("default_check_interval_months").notNull().default(6),
  defaultValidityYears: integer("default_validity_years"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ============================================================================
// MEMBER LICENSES (Welche Klassen hat ein Mitglied?)
// ============================================================================
export const memberLicenses = fk.table("member_licenses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  licenseClassId: text("license_class_id").notNull().references(() => licenseClasses.id),
  issueDate: text("issue_date"),
  expiryDate: text("expiry_date"),
  checkIntervalMonths: integer("check_interval_months").notNull().default(6),
  notes: text("notes"),
  restriction188: boolean("restriction_188").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});

// ============================================================================
// LICENSE CHECKS (Kontrollprotokoll)
// ============================================================================
export const licenseChecks = fk.table("license_checks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  checkedByUserId: text("checked_by_user_id").references(() => users.id),
  checkDate: text("check_date").notNull(),
  checkType: text("check_type", { enum: ["photo_upload", "in_person"] }).notNull(),
  result: text("result", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  nextCheckDue: text("next_check_due"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});

// ============================================================================
// UPLOADED FILES (Führerschein-Fotos, verschlüsselt)
// ============================================================================
export const uploadedFiles = fk.table("uploaded_files", {
  id: text("id").primaryKey(),
  checkId: text("check_id").notNull().references(() => licenseChecks.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size"),
  side: text("side", { enum: ["front", "back"] }).notNull(),
  autoDeleteAfter: text("auto_delete_after"),
  uploadedAt: timestamp("uploaded_at", { mode: "string" }).notNull().defaultNow(),
});

// ============================================================================
// CONSENT RECORDS (DSGVO-Einwilligungen)
// ============================================================================
export const consentRecords = fk.table("consent_records", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  consentType: text("consent_type", {
    enum: ["data_processing", "email_notifications", "photo_upload"],
  }).notNull(),
  given: boolean("given").notNull().default(false),
  givenAt: text("given_at"),
  withdrawnAt: text("withdrawn_at"),
  policyVersion: text("policy_version").notNull(),
  method: text("method").notNull().default("web_form"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});

// ============================================================================
// NOTIFICATIONS LOG
// ============================================================================
export const notificationsLog = fk.table("notifications_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["check_reminder_4w", "check_reminder_1w", "check_overdue", "license_expiry_3m", "license_expiry_1m", "license_expired", "admin_summary"],
  }).notNull(),
  subject: text("subject"),
  sentAt: timestamp("sent_at", { mode: "string" }).notNull().defaultNow(),
  status: text("status", { enum: ["sent", "failed", "pending"] }).notNull().default("pending"),
  errorMessage: text("error_message"),
});

// ============================================================================
// AUDIT LOG
// ============================================================================
export const auditLog = fk.table("audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});

// ============================================================================
// SETTINGS (App-Konfiguration)
// ============================================================================
export const appSettings = fk.table("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================
export const usersRelations = relations(users, ({ many }) => ({
  memberLicenses: many(memberLicenses),
  licenseChecks: many(licenseChecks, { relationName: "userChecks" }),
  checkedByMe: many(licenseChecks, { relationName: "checkerChecks" }),
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
  user: one(users, { fields: [licenseChecks.userId], references: [users.id], relationName: "userChecks" }),
  checkedBy: one(users, { fields: [licenseChecks.checkedByUserId], references: [users.id], relationName: "checkerChecks" }),
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
