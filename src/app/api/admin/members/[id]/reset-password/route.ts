import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";
import { generateSecurePassword } from "@/lib/security";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const limit = apiLimiter.check(ip);
  if (!limit.success) return rateLimitResponse(limit.retryAfterMs);

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await params;

  // Check member exists
  const member = db.query.users
    .findFirst({ where: eq(users.id, id) })
    .sync();

  if (!member) {
    return NextResponse.json(
      { error: "Mitglied nicht gefunden" },
      { status: 404 }
    );
  }

  // Generate cryptographically secure temp password
  const tempPassword = generateSecurePassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  db.update(users)
    .set({
      passwordHash,
      mustChangePassword: true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, id))
    .run();

  logAudit({
    userId: session.user.id,
    action: "password_reset",
    entityType: "user",
    entityId: id,
    details: { targetUser: member.email },
  });

  return NextResponse.json({
    success: true,
    tempPassword,
    message: `Neues temporäres Passwort für ${member.name}`,
  });
}
