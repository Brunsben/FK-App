import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberLicenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { updateMemberSchema, validateBody } from "@/lib/validations";
import { getMemberView, updateMember } from "@/lib/db/helpers";

// GET single member
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await params;

  const member = await getMemberView(id, {
    withLicenses: true,
    withChecks: true,
  });

  if (!member) {
    return NextResponse.json({ error: "Mitglied nicht gefunden" }, { status: 404 });
  }

  // passwordHash entfernen
  const { passwordHash: _pw, ...safeMember } = member;

  return NextResponse.json(safeMember);
}

// PUT update member
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const validation = validateBody(updateMemberSchema, body);
  if (!validation.success) return validation.response;
  const { name, email, dateOfBirth, phone, role, isActive, licenses } = validation.data;

  await updateMember(id, {
    name,
    email: email?.toLowerCase().trim(),
    dateOfBirth: dateOfBirth || null,
    phone: phone || null,
    role,
    isActive: isActive ?? true,
  });

  // Update licenses: delete existing, insert new
  if (licenses && Array.isArray(licenses)) {
    await db.delete(memberLicenses).where(eq(memberLicenses.memberId, id));

    for (const lic of licenses) {
      await db.insert(memberLicenses).values({
        memberId: id,
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
    action: "member_updated",
    entityType: "member",
    entityId: id,
    details: { name, email },
  });

  return NextResponse.json({ success: true });
}

// DELETE member (soft delete)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await params;

  await updateMember(id, { isActive: false });

  await logAudit({
    memberId: session.user.id,
    action: "member_deactivated",
    entityType: "member",
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
