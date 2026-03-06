import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { licenseChecks, memberLicenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { updateCheckSchema, validateBody } from "@/lib/validations";

// PUT – approve or reject a check
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const validation = validateBody(updateCheckSchema, body);
  if (!validation.success) return validation.response;
  const { result, rejectionReason } = validation.data;

  const check = await db.query.licenseChecks.findFirst({
    where: eq(licenseChecks.id, id),
  });

  if (!check) {
    return NextResponse.json({ error: "Kontrolle nicht gefunden" }, { status: 404 });
  }

  let nextCheckDue = check.nextCheckDue;

  if (result === "approved") {
    // Calculate next check due
    const memberLicense = await db.query.memberLicenses.findFirst({
      where: eq(memberLicenses.memberId, check.memberId),
    });
    const intervalMonths = memberLicense?.checkIntervalMonths || 6;
    const nextDue = new Date();
    nextDue.setMonth(nextDue.getMonth() + intervalMonths);
    nextCheckDue = nextDue.toISOString().split("T")[0];
  }

  await db.update(licenseChecks)
    .set({
      result,
      rejectionReason: result === "rejected" ? rejectionReason : null,
      checkedByMemberId: session.user.id,
      nextCheckDue,
    })
    .where(eq(licenseChecks.id, id));

  await logAudit({
    memberId: session.user.id,
    action: `check_${result}`,
    entityType: "license_check",
    entityId: id,
    details: { memberId: check.memberId, result, rejectionReason },
  });

  return NextResponse.json({ success: true });
}
