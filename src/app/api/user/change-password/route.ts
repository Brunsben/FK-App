import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import { logAudit } from "@/lib/audit";
import { changePasswordSchema, validateBody } from "@/lib/validations";
import { passwordLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // Rate Limiting
  const ip = getClientIp(req);
  const limit = passwordLimiter.check(ip);
  if (!limit.success) return rateLimitResponse(limit.retryAfterMs);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = await req.json();
  const validation = validateBody(changePasswordSchema, body);
  if (!validation.success) return validation.response;
  const { newPassword } = validation.data;

  const passwordHash = hashSync(newPassword, 12);

  db.update(users)
    .set({
      passwordHash,
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, session.user.id))
    .run();

  logAudit({
    userId: session.user.id,
    action: "password_changed",
    entityType: "user",
    entityId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
