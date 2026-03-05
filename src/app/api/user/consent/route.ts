import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, consentRecords } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { logAudit } from "@/lib/audit";
import { consentSchema, validateBody } from "@/lib/validations";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = await req.json();
  const validation = validateBody(consentSchema, body);
  if (!validation.success) return validation.response;
  const { dataProcessing, emailNotifications, photoUpload, policyVersion } = validation.data;

  if (!dataProcessing) {
    return NextResponse.json(
      { error: "Die Einwilligung zur Datenverarbeitung ist erforderlich." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  // Save consent records
  const consents = [
    { type: "data_processing" as const, given: dataProcessing },
    { type: "email_notifications" as const, given: emailNotifications },
    { type: "photo_upload" as const, given: photoUpload },
  ];

  for (const consent of consents) {
    db.insert(consentRecords)
      .values({
        id: uuid(),
        userId: session.user.id,
        consentType: consent.type,
        given: consent.given,
        givenAt: consent.given ? now : null,
        policyVersion,
        method: "web_form",
        ipAddress: ip,
      })
      .run();
  }

  // Update user consent flag
  db.update(users)
    .set({ consentGiven: true, updatedAt: now })
    .where(eq(users.id, session.user.id))
    .run();

  logAudit({
    userId: session.user.id,
    action: "consent_given",
    details: { dataProcessing, emailNotifications, photoUpload, policyVersion },
    ipAddress: ip,
  });

  return NextResponse.json({ success: true });
}
