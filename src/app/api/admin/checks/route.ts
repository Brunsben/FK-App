import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { licenseChecks, memberLicenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { logAudit } from "@/lib/audit";
import { createCheckSchema, validateBody } from "@/lib/validations";

// GET all checks (admin) or own checks (member)
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const isAdmin = session.user.role === "admin";

  const checks = db.query.licenseChecks.findMany({
    where: isAdmin ? undefined : eq(licenseChecks.userId, session.user.id),
    with: {
      user: true,
      checkedBy: true,
      uploadedFiles: true,
    },
    orderBy: (c: any, { desc }: any) => [desc(c.checkDate)],
  }).sync();

  // passwordHash aus verschachtelten User-Objekten entfernen
  const safeChecks = checks.map((check: any) => {
    const { user, checkedBy, ...rest } = check;
    const { passwordHash: _pw1, ...safeUser } = user || {};
    const { passwordHash: _pw2, ...safeChecker } = checkedBy || {};
    return { ...rest, user: safeUser, checkedBy: check.checkedBy ? safeChecker : null };
  });

  return NextResponse.json(safeChecks);
}

// POST create new check (in-person by admin)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const body = await req.json();
  const validation = validateBody(createCheckSchema, body);
  if (!validation.success) return validation.response;
  const { userId, checkType, result, notes } = validation.data;

  const now = new Date();
  const checkDate = now.toISOString().split("T")[0];

  // Calculate next check due based on member's license check interval
  const memberLicense = db.query.memberLicenses.findFirst({
    where: eq(memberLicenses.userId, userId),
  }).sync();
  const intervalMonths = memberLicense?.checkIntervalMonths || 6;
  const nextCheckDue = new Date(now);
  nextCheckDue.setMonth(nextCheckDue.getMonth() + intervalMonths);

  const checkId = uuid();

  db.insert(licenseChecks)
    .values({
      id: checkId,
      userId,
      checkedByUserId: session.user.id,
      checkDate,
      checkType: checkType || "in_person",
      result: result || "approved",
      nextCheckDue: nextCheckDue.toISOString().split("T")[0],
      notes: notes || null,
    })
    .run();

  logAudit({
    userId: session.user.id,
    action: `check_${result || "approved"}`,
    entityType: "license_check",
    entityId: checkId,
    details: { userId, checkType: checkType || "in_person" },
  });

  return NextResponse.json({ success: true, checkId });
}
