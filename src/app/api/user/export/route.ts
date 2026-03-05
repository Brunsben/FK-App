import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const user = db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    with: {
      memberLicenses: { with: { licenseClass: true } },
      licenseChecks: true,
      consentRecords: true,
    },
  }).sync();

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  // Remove sensitive fields
  const { passwordHash: _pw, ...safeUser } = user;

  logAudit({
    userId: session.user.id,
    action: "data_exported",
    entityType: "user",
    entityId: session.user.id,
  });

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    userData: safeUser,
  });
}
