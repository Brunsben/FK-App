import { text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { pgSchema } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================
const fwCommon = pgSchema("fw_common");
const fwFk = pgSchema("fw_fuehrerschein");

// ============================================================================
// fw_common TABLES (read-only from this app)
// ============================================================================
export const members = fwCommon.table("members", {
  id: uuid("id").primaryKey(),
  vorname: text("Vorname"),
  name: text("Name"),
  dienstgrad: text("Dienstgrad"),
  email: text("Email"),
  telefon: text("Telefon"),
  geburtsdatum: text("Geburtsdatum"),
  aktiv: boolean("Aktiv").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const accounts = fwCommon.table("accounts", {
  id: uuid("id").primaryKey(),
  benutzername: text("Benutzername").unique().notNull(),
  pin: text("PIN").notNull(),
  rolle: text("Rolle").notNull().default("User"),
  aktiv: boolean("Aktiv").notNull().default(true),
  kameradId: uuid("KameradId").references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }),
});

export const appPermissions = fwCommon.table("app_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  app: text("app").notNull(), // 'psa' | 'food' | 'fk'
  rolle: text("rolle").notNull().default("User"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// MEMBER PROFILES (FK-specific data)
// ============================================================================
export const memberProfiles = fwFk.table("member_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull().unique().references(() => members.id, { onDelete: "cascade" }),
  consentGiven: boolean("consent_given").notNull().default(false),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// LICENSE CLASSES (Führerscheinklassen)
// ============================================================================
export const licenseClasses = fwFk.table("license_classes", {
  id: uuid("id").primaryKey().defaultRandom(),
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
export const memberLicenses = fwFk.table("member_licenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  licenseClassId: uuid("license_class_id").notNull().references(() => licenseClasses.id),
  issueDate: text("issue_date"),
  expiryDate: text("expiry_date"),
  checkIntervalMonths: integer("check_interval_months").notNull().default(6),
  notes: text("notes"),
  restriction188: boolean("restriction_188").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// LICENSE CHECKS (Kontrollprotokoll)
// ============================================================================
export const licenseChecks = fwFk.table("license_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  checkedByMemberId: uuid("checked_by_member_id").references(() => members.id),
  checkDate: text("check_date").notNull(),
  checkType: text("check_type").notNull(), // 'photo_upload' | 'in_person'
  result: text("result").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  rejectionReason: text("rejection_reason"),
  nextCheckDue: text("next_check_due"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// UPLOADED FILES (Führerschein-Fotos, verschlüsselt)
// ============================================================================
export const uploadedFiles = fwFk.table("uploaded_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  checkId: uuid("check_id").notNull().references(() => licenseChecks.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size"),
  side: text("side").notNull(), // 'front' | 'back'
  autoDeleteAfter: text("auto_delete_after"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// CONSENT RECORDS (DSGVO-Einwilligungen)
// ============================================================================
export const consentRecords = fwFk.table("consent_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  consentType: text("consent_type").notNull(), // 'data_processing' | 'email_notifications' | 'photo_upload'
  given: boolean("given").notNull().default(false),
  givenAt: text("given_at"),
  withdrawnAt: text("withdrawn_at"),
  policyVersion: text("policy_version").notNull(),
  method: text("method").notNull().default("web_form"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// NOTIFICATIONS LOG
// ============================================================================
export const notificationsLog = fwFk.table("notifications_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'check_reminder_4w' | 'check_reminder_1w' | 'check_overdue' | ...
  subject: text("subject"),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
  status: text("status").notNull().default("pending"), // 'sent' | 'failed' | 'pending'
  errorMessage: text("error_message"),
});

// ============================================================================
// AUDIT LOG
// ============================================================================
export const auditLog = fwFk.table("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").references(() => members.id),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// SETTINGS (App-Konfiguration)
// ============================================================================
export const appSettings = fwFk.table("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================
export const membersRelations = relations(members, ({ many, one }) => ({
  account: one(accounts, { fields: [members.id], references: [accounts.kameradId] }),
  profile: one(memberProfiles, { fields: [members.id], references: [memberProfiles.memberId] }),
  memberLicenses: many(memberLicenses),
  licenseChecks: many(licenseChecks, { relationName: "memberChecks" }),
  checkedByMe: many(licenseChecks, { relationName: "checkerChecks" }),
  uploadedFiles: many(uploadedFiles),
  consentRecords: many(consentRecords),
  notifications: many(notificationsLog),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  member: one(members, { fields: [accounts.kameradId], references: [members.id] }),
  appPermissions: many(appPermissions),
}));

export const appPermissionsRelations = relations(appPermissions, ({ one }) => ({
  account: one(accounts, { fields: [appPermissions.accountId], references: [accounts.id] }),
}));

export const memberProfilesRelations = relations(memberProfiles, ({ one }) => ({
  member: one(members, { fields: [memberProfiles.memberId], references: [members.id] }),
}));

export const licenseClassesRelations = relations(licenseClasses, ({ many }) => ({
  memberLicenses: many(memberLicenses),
}));

export const memberLicensesRelations = relations(memberLicenses, ({ one }) => ({
  member: one(members, { fields: [memberLicenses.memberId], references: [members.id] }),
  licenseClass: one(licenseClasses, { fields: [memberLicenses.licenseClassId], references: [licenseClasses.id] }),
}));

export const licenseChecksRelations = relations(licenseChecks, ({ one, many }) => ({
  member: one(members, { fields: [licenseChecks.memberId], references: [members.id], relationName: "memberChecks" }),
  checkedBy: one(members, { fields: [licenseChecks.checkedByMemberId], references: [members.id], relationName: "checkerChecks" }),
  uploadedFiles: many(uploadedFiles),
}));

export const uploadedFilesRelations = relations(uploadedFiles, ({ one }) => ({
  check: one(licenseChecks, { fields: [uploadedFiles.checkId], references: [licenseChecks.id] }),
  member: one(members, { fields: [uploadedFiles.memberId], references: [members.id] }),
}));

export const consentRecordsRelations = relations(consentRecords, ({ one }) => ({
  member: one(members, { fields: [consentRecords.memberId], references: [members.id] }),
}));

export const notificationsLogRelations = relations(notificationsLog, ({ one }) => ({
  member: one(members, { fields: [notificationsLog.memberId], references: [members.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  member: one(members, { fields: [auditLog.memberId], references: [members.id] }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================
export type Member = typeof members.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type AppPermission = typeof appPermissions.$inferSelect;
export type MemberProfile = typeof memberProfiles.$inferSelect;
export type LicenseClass = typeof licenseClasses.$inferSelect;
export type MemberLicense = typeof memberLicenses.$inferSelect;
export type LicenseCheck = typeof licenseChecks.$inferSelect;
export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type ConsentRecord = typeof consentRecords.$inferSelect;
export type NotificationLog = typeof notificationsLog.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;

// Composite type: Member with all related data from fw_common + fw_fuehrerschein
export type MemberView = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  dateOfBirth: string | null;
  phone: string | null;
  isActive: boolean;
  consentGiven: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
};
