import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { consentRecords } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Withdraw email notification consent
  await db.update(consentRecords)
    .set({ withdrawnAt: now })
    .where(
      and(
        eq(consentRecords.memberId, session.user.id),
        eq(consentRecords.consentType, "email_notifications"),
        isNull(consentRecords.withdrawnAt)
      )
    );

  await logAudit({
    memberId: session.user.id,
    action: "consent_withdrawn",
    details: { consentType: "email_notifications" },
  });

  return NextResponse.json({ success: true });
}
