import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getMemberView } from "@/lib/db/helpers";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const user = await getMemberView(session.user.id, {
    withLicenses: true,
    withChecks: true,
    withConsent: true,
  });

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  // Remove sensitive fields
  const { passwordHash: _pw, ...safeUser } = user;

  await logAudit({
    memberId: session.user.id,
    action: "data_exported",
    entityType: "member",
    entityId: session.user.id,
  });

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    userData: safeUser,
  });
}
