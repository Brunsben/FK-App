import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberLicenses } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { createMemberSchema, validateBody } from "@/lib/validations";
import { generateSecurePassword } from "@/lib/security";
import { getActiveMemberViews, createMember } from "@/lib/db/helpers";

// GET all members (admin only)
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const allMembers = await getActiveMemberViews({ withLicenses: true });

  // passwordHash entfernen
  const safeMembers = allMembers.map(({ passwordHash: _pw, ...rest }) => rest);

  return NextResponse.json(safeMembers);
}

// POST create new member
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const body = await req.json();
  const validation = validateBody(createMemberSchema, body);
  if (!validation.success) return validation.response;
  const { name, email, dateOfBirth, phone, role, licenses, generatePassword } = validation.data;

  // Check if email already exists (via accounts table)
  const { accounts } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const existing = await db.query.accounts.findFirst({
    where: eq(accounts.benutzername, email.toLowerCase().trim()),
  });
  if (existing) {
    return NextResponse.json({ error: "Diese E-Mail-Adresse ist bereits vergeben." }, { status: 400 });
  }

  // Generate a cryptographically secure password
  const tempPassword = generatePassword || generateSecurePassword();

  const memberId = await createMember({
    name,
    email,
    dateOfBirth: dateOfBirth || null,
    phone: phone || null,
    role: role || "member",
    password: tempPassword,
  });

  // Add license classes if provided
  if (licenses && Array.isArray(licenses)) {
    for (const lic of licenses) {
      await db.insert(memberLicenses).values({
        memberId,
        licenseClassId: lic.licenseClassId,
        issueDate: lic.issueDate || null,
        expiryDate: lic.expiryDate || null,
        checkIntervalMonths: lic.checkIntervalMonths || 6,
        restriction188: lic.restriction188 || false,
        notes: lic.notes || null,
      });
    }
  }

  await logAudit({
    memberId: session.user.id,
    action: "member_created",
    entityType: "member",
    entityId: memberId,
    details: { name, email, role: role || "member" },
  });

  return NextResponse.json({
    success: true,
    userId: memberId,
    tempPassword,
  });
}
