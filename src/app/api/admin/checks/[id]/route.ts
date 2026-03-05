import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { licenseChecks, memberLicenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

// PUT – approve or reject a check
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { result, rejectionReason } = body;

  if (!["approved", "rejected"].includes(result)) {
    return NextResponse.json({ error: "Ungültiges Ergebnis" }, { status: 400 });
  }

  const check = db.query.licenseChecks.findFirst({
    where: eq(licenseChecks.id, id),
  }).sync();

  if (!check) {
    return NextResponse.json({ error: "Kontrolle nicht gefunden" }, { status: 404 });
  }

  let nextCheckDue = check.nextCheckDue;

  if (result === "approved") {
    // Calculate next check due
    const memberLicense = db.query.memberLicenses.findFirst({
      where: eq(memberLicenses.userId, check.userId),
    }).sync();
    const intervalMonths = memberLicense?.checkIntervalMonths || 6;
    const nextDue = new Date();
    nextDue.setMonth(nextDue.getMonth() + intervalMonths);
    nextCheckDue = nextDue.toISOString().split("T")[0];
  }

  db.update(licenseChecks)
    .set({
      result,
      rejectionReason: result === "rejected" ? rejectionReason : null,
      checkedByUserId: session.user.id,
      nextCheckDue,
    })
    .where(eq(licenseChecks.id, id))
    .run();

  logAudit({
    userId: session.user.id,
    action: `check_${result}`,
    entityType: "license_check",
    entityId: id,
    details: { userId: check.userId, result, rejectionReason },
  });

  return NextResponse.json({ success: true });
}
