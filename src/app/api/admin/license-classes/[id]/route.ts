import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { licenseClasses, memberLicenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// PUT update license class
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = getClientIp(req);
  const limit = apiLimiter.check(ip);
  if (!limit.success) return rateLimitResponse(limit.retryAfterMs);

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await params;
  const existing = db.query.licenseClasses
    .findFirst({ where: eq(licenseClasses.id, id) })
    .sync();
  if (!existing) {
    return NextResponse.json(
      { error: "Klasse nicht gefunden" },
      { status: 404 },
    );
  }

  const body = await req.json();
  const {
    code,
    name,
    description,
    isExpiring,
    defaultCheckIntervalMonths,
    defaultValidityYears,
    sortOrder,
  } = body;

  if (!code?.trim() || !name?.trim()) {
    return NextResponse.json(
      { error: "Code und Name sind Pflichtfelder" },
      { status: 400 },
    );
  }

  // Check uniqueness (other than self)
  const duplicate = db.query.licenseClasses
    .findFirst({ where: eq(licenseClasses.code, code.trim()) })
    .sync();
  if (duplicate && duplicate.id !== id) {
    return NextResponse.json(
      { error: `Code „${code}" ist bereits vergeben` },
      { status: 409 },
    );
  }

  db.update(licenseClasses)
    .set({
      code: code.trim(),
      name: name.trim(),
      description: description?.trim() || null,
      isExpiring: isExpiring ?? false,
      defaultCheckIntervalMonths: defaultCheckIntervalMonths ?? 6,
      defaultValidityYears: defaultValidityYears || null,
      sortOrder: sortOrder ?? 0,
    })
    .where(eq(licenseClasses.id, id))
    .run();

  logAudit({
    userId: session.user.id,
    action: "license_class.updated",
    entityType: "license_class",
    entityId: id,
    details: { code: code.trim(), name: name.trim() },
    ipAddress: ip,
  });

  return NextResponse.json({ success: true });
}

// DELETE license class
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = getClientIp(req);
  const limit = apiLimiter.check(ip);
  if (!limit.success) return rateLimitResponse(limit.retryAfterMs);

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await params;
  const existing = db.query.licenseClasses
    .findFirst({ where: eq(licenseClasses.id, id) })
    .sync();
  if (!existing) {
    return NextResponse.json(
      { error: "Klasse nicht gefunden" },
      { status: 404 },
    );
  }

  // Check if in use
  const usageCount = db.query.memberLicenses
    .findMany({ where: eq(memberLicenses.licenseClassId, id) })
    .sync().length;
  if (usageCount > 0) {
    return NextResponse.json(
      {
        error: `Kann nicht gelöscht werden – ${usageCount} Mitglied(er) nutzen diese Klasse`,
      },
      { status: 409 },
    );
  }

  db.delete(licenseClasses).where(eq(licenseClasses.id, id)).run();

  logAudit({
    userId: session.user.id,
    action: "license_class.deleted",
    entityType: "license_class",
    entityId: id,
    details: { code: existing.code, name: existing.name },
    ipAddress: ip,
  });

  return NextResponse.json({ success: true });
}
