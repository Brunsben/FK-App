import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, memberLicenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { logAudit } from "@/lib/audit";
import { updateMemberSchema, validateBody } from "@/lib/validations";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// GET single member
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req);
  const limit = apiLimiter.check(ip);
  if (!limit.success) return rateLimitResponse(limit.retryAfterMs);

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await params;

  const member = await db.query.users.findFirst({
    where: eq(users.id, id),
    with: {
      memberLicenses: {
        with: { licenseClass: true },
      },
      licenseChecks: {
        orderBy: (checks: any, { desc }: any) => [desc(checks.checkDate)],
      },
    },
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
  const ip = getClientIp(req);
  const limit = apiLimiter.check(ip);
  if (!limit.success) return rateLimitResponse(limit.retryAfterMs);

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const validation = validateBody(updateMemberSchema, body);
  if (!validation.success) return validation.response;
  const { name, email, dateOfBirth, phone, role, isActive, licenses } = validation.data;

  await db.update(users)
    .set({
      name: name,
      email: email?.toLowerCase().trim(),
      dateOfBirth: dateOfBirth || null,
      phone: phone || null,
      role: role,
      isActive: isActive ?? true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, id));

  // Update licenses: delete existing, insert new
  if (licenses && Array.isArray(licenses)) {
    await db.delete(memberLicenses).where(eq(memberLicenses.userId, id));

    for (const lic of licenses) {
      await db.insert(memberLicenses)
        .values({
          id: uuid(),
          userId: id,
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
    userId: session.user.id,
    action: "member_updated",
    entityType: "user",
    entityId: id,
    details: { name, email },
  });

  return NextResponse.json({ success: true });
}

// DELETE member (soft delete)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req);
  const limit = apiLimiter.check(ip);
  if (!limit.success) return rateLimitResponse(limit.retryAfterMs);

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await params;

  await db.update(users)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(eq(users.id, id));

  await logAudit({
    userId: session.user.id,
    action: "member_deactivated",
    entityType: "user",
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
