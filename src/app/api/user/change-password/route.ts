import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hashSync } from "bcryptjs";
import { logAudit } from "@/lib/audit";
import { changePasswordSchema, validateBody } from "@/lib/validations";
import { passwordLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { setMemberPassword } from "@/lib/db/helpers";

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

  await setMemberPassword(session.user.id, passwordHash, false);

  await logAudit({
    memberId: session.user.id,
    action: "password_changed",
    entityType: "member",
    entityId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
