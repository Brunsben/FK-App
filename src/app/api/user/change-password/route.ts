import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { newPassword } = await req.json();

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: "Das Passwort muss mindestens 8 Zeichen lang sein." },
      { status: 400 }
    );
  }

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
