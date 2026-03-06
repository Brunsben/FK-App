import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { licenseChecks, memberLicenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { createCheckSchema, validateBody } from "@/lib/validations";

// GET all checks (admin) or own checks (member)
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const isAdmin = session.user.role === "admin";

  const checks = await db.query.licenseChecks.findMany({
    where: isAdmin ? undefined : eq(licenseChecks.memberId, session.user.id),
    with: {
      member: {
        with: { account: true, profile: true },
      },
      checkedBy: true,
      uploadedFiles: true,
    },
    orderBy: (c: any, { desc }: any) => [desc(c.checkDate)],
  });

  // Flatten member info to match old user format
  const { toUserView } = await import("@/lib/db/helpers");
  const safeChecks = checks.map((check: any) => {
    const { member, checkedBy, ...rest } = check;
    const safeUser = member ? (() => { const { passwordHash: _pw, ...safe } = toUserView(member); return safe; })() : {};
    const safeChecker = checkedBy ? { id: checkedBy.id, name: [checkedBy.vorname, checkedBy.name].filter(Boolean).join(" ") } : null;
    return { ...rest, user: safeUser, checkedBy: safeChecker };
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
  const { memberId, checkType, result, notes } = validation.data;

  const now = new Date();
  const checkDate = now.toISOString().split("T")[0];

  // Calculate next check due based on member's license check interval
  const memberLicense = await db.query.memberLicenses.findFirst({
    where: eq(memberLicenses.memberId, memberId),
  });
  const intervalMonths = memberLicense?.checkIntervalMonths || 6;
  const nextCheckDue = new Date(now);
  nextCheckDue.setMonth(nextCheckDue.getMonth() + intervalMonths);

  const inserted = await db.insert(licenseChecks)
    .values({
      memberId,
      checkedByMemberId: session.user.id,
      checkDate,
      checkType: checkType || "in_person",
      result: result || "approved",
      nextCheckDue: nextCheckDue.toISOString().split("T")[0],
      notes: notes || null,
    })
    .returning({ id: licenseChecks.id });

  const checkId = inserted[0].id;

  await logAudit({
    memberId: session.user.id,
    action: `check_${result || "approved"}`,
    entityType: "license_check",
    entityId: checkId,
    details: { memberId, checkType: checkType || "in_person" },
  });

  return NextResponse.json({ success: true, checkId });
}
