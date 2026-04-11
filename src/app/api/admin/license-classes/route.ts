import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { licenseClasses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { logAudit } from "@/lib/audit";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// GET all license classes (sorted)
export async function GET(req: Request) {
  const ip = getClientIp(req);
  const limit = apiLimiter.check(ip);
  if (!limit.success) return rateLimitResponse(limit.retryAfterMs);

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const classes = await db.query.licenseClasses.findMany({
    orderBy: (c: any, { asc }: any) => [asc(c.sortOrder)],
  });

  return NextResponse.json(classes);
}

// POST create new license class
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = apiLimiter.check(ip);
  if (!limit.success) return rateLimitResponse(limit.retryAfterMs);

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
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

  // Check uniqueness
  const existing = await db.query.licenseClasses.findFirst({
    where: eq(licenseClasses.code, code.trim()),
  });
  if (existing) {
    return NextResponse.json(
      { error: `Klasse mit Code „${code}" existiert bereits` },
      { status: 409 },
    );
  }

  const id = uuid();
  await db.insert(licenseClasses).values({
    id,
    code: code.trim(),
    name: name.trim(),
    description: description?.trim() || null,
    isExpiring: isExpiring ?? false,
    defaultCheckIntervalMonths: defaultCheckIntervalMonths ?? 6,
    defaultValidityYears: defaultValidityYears || null,
    sortOrder: sortOrder ?? 0,
  });

  await logAudit({
    userId: session.user.id,
    action: "license_class.created",
    entityType: "license_class",
    entityId: id,
    details: { code: code.trim(), name: name.trim() },
    ipAddress: ip,
  });

  return NextResponse.json(
    { id, code: code.trim(), name: name.trim() },
    { status: 201 },
  );
}
