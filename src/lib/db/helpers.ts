/**
 * Helper-Funktionen zum Brücken zwischen dem alten Single-User-Modell
 * und der neuen Multi-Tabellen-Struktur (fw_common + fw_fuehrerschein).
 *
 * Stellt eine "UserView" bereit, die das alte User-Interface nachahmt,
 * damit Server Components und API-Routes minimal geändert werden müssen.
 */

import { db } from "@/lib/db";
import { members, accounts, memberProfiles, memberLicenses } from "@/lib/db/schema";
import type { MemberView } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { hashSync } from "bcryptjs";

// ============================================================================
// READ HELPERS — Composite UserView from 3 tables
// ============================================================================

/**
 * Wandelt ein Member-Query-Ergebnis (mit account/profile Relations) in
 * das alte User-Format um, damit Rendering-Code fast unverändert bleibt.
 */
export function toUserView(member: any): MemberView & Record<string, any> {
  const account = member.account;
  const profile = member.profile;

  return {
    // Identity
    id: member.id,
    name: [member.vorname, member.name].filter(Boolean).join(" ") || "Unbekannt",
    email: account?.benutzername || member.email || "",

    // Auth (not exposed to client, but used internally)
    passwordHash: account?.pin || "",
    role: account?.rolle === "Admin" ? "admin" : "member",

    // Status
    isActive: member.aktiv ?? true,
    dateOfBirth: member.geburtsdatum || null,
    phone: member.telefon || null,

    // FK-specific
    consentGiven: profile?.consentGiven ?? false,
    mustChangePassword: profile?.mustChangePassword ?? true,

    // Timestamps
    createdAt: member.createdAt instanceof Date
      ? member.createdAt.toISOString()
      : member.createdAt || "",
    updatedAt: member.updatedAt instanceof Date
      ? member.updatedAt.toISOString()
      : member.updatedAt || "",

    // Pass through loaded relations
    ...(member.memberLicenses !== undefined && { memberLicenses: member.memberLicenses }),
    ...(member.licenseChecks !== undefined && { licenseChecks: member.licenseChecks }),
    ...(member.consentRecords !== undefined && { consentRecords: member.consentRecords }),
    ...(member.notifications !== undefined && { notifications: member.notifications }),
    ...(member.uploadedFiles !== undefined && { uploadedFiles: member.uploadedFiles }),
  };
}

/**
 * Holt ein einzelnes Mitglied mit optionalen Relations.
 * Gibt ein UserView-Objekt zurück (oder null).
 */
export async function getMemberView(
  memberId: string,
  opts?: {
    withLicenses?: boolean;
    withChecks?: boolean;
    withConsent?: boolean;
    checksLimit?: number;
    checksOrder?: "asc" | "desc";
  }
): Promise<(MemberView & Record<string, any>) | null> {
  const withClause: Record<string, any> = {
    account: true,
    profile: true,
  };

  if (opts?.withLicenses) {
    withClause.memberLicenses = { with: { licenseClass: true } };
  }
  if (opts?.withChecks) {
    withClause.licenseChecks = {
      orderBy: (checks: any, { desc }: any) => [desc(checks.checkDate)],
      ...(opts.checksLimit ? { limit: opts.checksLimit } : {}),
    };
  }
  if (opts?.withConsent) {
    withClause.consentRecords = {
      orderBy: (c: any, { desc }: any) => [desc(c.createdAt)],
    };
  }

  const member = await db.query.members.findFirst({
    where: eq(members.id, memberId),
    with: withClause,
  });

  if (!member) return null;
  return toUserView(member);
}

/**
 * Holt alle aktiven Mitglieder mit Account+Profil.
 */
export async function getActiveMemberViews(
  opts?: {
    withLicenses?: boolean;
    withChecks?: boolean;
    checksLimit?: number;
  }
): Promise<(MemberView & Record<string, any>)[]> {
  const withClause: Record<string, any> = {
    account: true,
    profile: true,
  };

  if (opts?.withLicenses) {
    withClause.memberLicenses = { with: { licenseClass: true } };
  }
  if (opts?.withChecks) {
    withClause.licenseChecks = {
      orderBy: (checks: any, { desc }: any) => [desc(checks.checkDate)],
      ...(opts.checksLimit ? { limit: opts.checksLimit } : {}),
    };
  }

  const allMembers = await db.query.members.findMany({
    where: eq(members.aktiv, true),
    with: withClause,
  });

  return allMembers.map(toUserView);
}

// ============================================================================
// WRITE HELPERS — CRUD across fw_common + fw_fuehrerschein
// ============================================================================

interface CreateMemberInput {
  name: string;
  email: string;
  dateOfBirth?: string | null;
  phone?: string | null;
  role?: "admin" | "member";
  password: string;
}

/**
 * Legt ein neues Mitglied an: fw_common.members + fw_common.accounts + fw_fuehrerschein.member_profiles
 * Returns the new member ID.
 */
export async function createMember(input: CreateMemberInput): Promise<string> {
  const memberId = uuid();
  const nameParts = input.name.split(" ");
  const vorname = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : "";
  const nachname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : input.name;

  // 1. fw_common.members
  await db.insert(members).values({
    id: memberId,
    vorname: vorname || null,
    name: nachname,
    email: input.email.toLowerCase().trim(),
    telefon: input.phone || null,
    geburtsdatum: input.dateOfBirth || null,
    aktiv: true,
  });

  // 2. fw_common.accounts
  const passwordHash = hashSync(input.password, 12);
  await db.insert(accounts).values({
    id: uuid(),
    benutzername: input.email.toLowerCase().trim(),
    pin: passwordHash,
    rolle: input.role === "admin" ? "Admin" : "User",
    aktiv: true,
    kameradId: memberId,
  });

  // 3. fw_fuehrerschein.member_profiles
  await db.insert(memberProfiles).values({
    memberId,
    consentGiven: false,
    mustChangePassword: true,
  });

  return memberId;
}

interface UpdateMemberInput {
  name?: string;
  email?: string;
  dateOfBirth?: string | null;
  phone?: string | null;
  role?: "admin" | "member";
  isActive?: boolean;
}

/**
 * Aktualisiert ein Mitglied über alle 3 Tabellen.
 */
export async function updateMember(memberId: string, input: UpdateMemberInput): Promise<void> {
  // 1. fw_common.members
  const memberUpdate: Record<string, any> = {};
  if (input.name) {
    const parts = input.name.split(" ");
    memberUpdate.vorname = parts.length > 1 ? parts.slice(0, -1).join(" ") : null;
    memberUpdate.name = parts.length > 1 ? parts[parts.length - 1] : input.name;
  }
  if (input.email) memberUpdate.email = input.email.toLowerCase().trim();
  if (input.phone !== undefined) memberUpdate.telefon = input.phone;
  if (input.dateOfBirth !== undefined) memberUpdate.geburtsdatum = input.dateOfBirth;
  if (input.isActive !== undefined) memberUpdate.aktiv = input.isActive;

  if (Object.keys(memberUpdate).length > 0) {
    await db.update(members).set(memberUpdate).where(eq(members.id, memberId));
  }

  // 2. fw_common.accounts (rolle + benutzername)
  const accountUpdate: Record<string, any> = {};
  if (input.role) accountUpdate.rolle = input.role === "admin" ? "Admin" : "User";
  if (input.email) accountUpdate.benutzername = input.email.toLowerCase().trim();
  if (input.isActive !== undefined) accountUpdate.aktiv = input.isActive;

  if (Object.keys(accountUpdate).length > 0) {
    await db.update(accounts).set(accountUpdate).where(eq(accounts.kameradId, memberId));
  }
}

/**
 * Setzt das Passwort eines Mitglieds.
 */
export async function setMemberPassword(memberId: string, passwordHash: string, mustChange = false): Promise<void> {
  await db.update(accounts).set({ pin: passwordHash }).where(eq(accounts.kameradId, memberId));
  await db.update(memberProfiles).set({ mustChangePassword: mustChange }).where(eq(memberProfiles.memberId, memberId));
}

/**
 * Aktualisiert FK-spezifische Profile-Daten.
 */
export async function updateMemberProfile(
  memberId: string,
  data: { consentGiven?: boolean; mustChangePassword?: boolean }
): Promise<void> {
  // Ensure profile exists (upsert)
  const existing = await db.query.memberProfiles.findFirst({
    where: eq(memberProfiles.memberId, memberId),
  });

  if (existing) {
    await db.update(memberProfiles).set(data).where(eq(memberProfiles.memberId, memberId));
  } else {
    await db.insert(memberProfiles).values({
      memberId,
      consentGiven: data.consentGiven ?? false,
      mustChangePassword: data.mustChangePassword ?? true,
    });
  }
}

/**
 * Authentifiziert ein Mitglied anhand von E-Mail + Passwort.
 * Gibt UserView zurück oder null.
 */
export async function authenticateMember(
  email: string,
  comparePassword: (hash: string) => boolean
): Promise<(MemberView & Record<string, any>) | null> {
  // Suche Account anhand Benutzername (= Email)
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.benutzername, email.toLowerCase().trim()),
    with: { member: true },
  });

  if (!account || !account.aktiv || !account.member) return null;
  if (!account.member.aktiv) return null;

  // Passwort prüfen
  if (!comparePassword(account.pin)) return null;

  // Profil laden
  const profile = await db.query.memberProfiles.findFirst({
    where: eq(memberProfiles.memberId, account.member.id),
  });

  return toUserView({
    ...account.member,
    account,
    profile,
  });
}
