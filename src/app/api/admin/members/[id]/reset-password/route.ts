import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getMemberView, setMemberPassword } from "@/lib/db/helpers";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { id } = await params;

  // Check member exists
  const member = await getMemberView(id);

  if (!member) {
    return NextResponse.json(
      { error: "Mitglied nicht gefunden" },
      { status: 404 }
    );
  }

  // Generate temp password
  const tempPassword = crypto.randomBytes(4).toString("hex"); // 8 Zeichen
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await setMemberPassword(id, passwordHash, true);

  await logAudit({
    memberId: session.user.id,
    action: "password_reset",
    entityType: "member",
    entityId: id,
    details: { targetUser: member.email },
  });

  return NextResponse.json({
    success: true,
    tempPassword,
    message: `Neues temporäres Passwort für ${member.name}`,
  });
}
