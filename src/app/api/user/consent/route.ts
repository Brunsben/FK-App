import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { consentRecords } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { consentSchema, validateBody } from "@/lib/validations";
import { updateMemberProfile } from "@/lib/db/helpers";

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
    await db.insert(consentRecords).values({
      memberId: session.user.id,
      consentType: consent.type,
      given: consent.given,
      givenAt: consent.given ? now : null,
      policyVersion,
      method: "web_form",
      ipAddress: ip,
    });
  }

  // Update member profile consent flag
  await updateMemberProfile(session.user.id, { consentGiven: true });

  await logAudit({
    memberId: session.user.id,
    action: "consent_given",
    details: { dataProcessing, emailNotifications, photoUpload, policyVersion },
    ipAddress: ip,
  });

  return NextResponse.json({ success: true });
}
