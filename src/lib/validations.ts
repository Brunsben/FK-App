import { z } from "zod/v4";

// ============================================================================
// Members
// ============================================================================

const licenseEntrySchema = z.object({
  licenseClassId: z.string().min(1),
  issueDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  checkIntervalMonths: z.number().int().min(0).max(24).optional().default(6),
  restriction188: z.boolean().optional().default(false),
  notes: z.string().nullable().optional(),
});

export const createMemberSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(200),
  email: z.email("Ungültige E-Mail-Adresse"),
  dateOfBirth: z.string().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  role: z.enum(["admin", "member"]).optional().default("member"),
  licenses: z.array(licenseEntrySchema).optional().default([]),
  generatePassword: z.string().min(8).optional(),
});

export const updateMemberSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(200),
  email: z.email("Ungültige E-Mail-Adresse"),
  dateOfBirth: z.string().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  role: z.enum(["admin", "member"]),
  isActive: z.boolean(),
  licenses: z.array(licenseEntrySchema).optional(),
});

// ============================================================================
// Checks
// ============================================================================

export const createCheckSchema = z.object({
  memberId: z.string().min(1, "Mitglied-ID erforderlich"),
  checkType: z.enum(["photo_upload", "in_person"]).optional().default("in_person"),
  result: z.enum(["pending", "approved", "rejected"]).optional().default("approved"),
  notes: z.string().max(1000).nullable().optional(),
});

export const updateCheckSchema = z.object({
  result: z.enum(["approved", "rejected"]),
  rejectionReason: z.string().max(500).nullable().optional(),
});

// ============================================================================
// Settings
// ============================================================================

export const updateSettingsSchema = z.record(z.string(), z.string().or(z.number()));

// ============================================================================
// Passwort
// ============================================================================

export const changePasswordSchema = z.object({
  newPassword: z.string().min(8, "Das Passwort muss mindestens 8 Zeichen lang sein.").max(128),
});

// ============================================================================
// Consent
// ============================================================================

export const consentSchema = z.object({
  dataProcessing: z.boolean(),
  emailNotifications: z.boolean().optional().default(false),
  photoUpload: z.boolean().optional().default(false),
  policyVersion: z.string().min(1),
});

// ============================================================================
// Hilfsfunktion: Validierung + Fehler-Response
// ============================================================================

import { NextResponse } from "next/server";

export function validateBody<T>(schema: z.ZodType<T>, data: unknown):
  | { success: true; data: T }
  | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message).join("; ");
    return {
      success: false,
      response: NextResponse.json(
        { error: "Validierungsfehler", details: errors },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}
