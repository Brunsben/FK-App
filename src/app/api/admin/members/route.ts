import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// GET all members (admin only)
export async function GET(req: Request) {
  const ip = getClientIp(req);
  const limit = apiLimiter.check(ip);
  if (!limit.success) return rateLimitResponse(limit.retryAfterMs);

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const allMembers = await db.query.users.findMany({
    where: eq(users.isActive, true),
    with: {
      memberLicenses: {
        with: { licenseClass: true },
      },
    },
    orderBy: (u: any, { asc }: any) => [asc(u.name)],
  });

  // passwordHash entfernen
  const safeMembers = allMembers.map(({ passwordHash: _pw, ...rest }) => rest);

  return NextResponse.json(safeMembers);
}
