import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members, licenseClasses, memberLicenses, licenseChecks, consentRecords, notificationsLog, auditLog, appSettings, memberProfiles } from "@/lib/db/schema";

// Protected by proxy (x-api-key header check)
export async function GET(req: Request) {
  // Zusätzliche API-Key-Prüfung (Defense in Depth)
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = process.env.BACKUP_API_KEY;
  if (!expectedKey || expectedKey.includes("CHANGE_ME") || apiKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const backup = {
      exportedAt: new Date().toISOString(),
      version: "2.0",
      tables: {
        members: await db.select().from(members),
        memberProfiles: await db.select().from(memberProfiles),
        licenseClasses: await db.select().from(licenseClasses),
        memberLicenses: await db.select().from(memberLicenses),
        licenseChecks: await db.select().from(licenseChecks),
        consentRecords: await db.select().from(consentRecords),
        notificationsLog: await db.select().from(notificationsLog),
        auditLog: await db.select().from(auditLog),
        appSettings: await db.select().from(appSettings),
      },
    };

    return NextResponse.json(backup);
  } catch (error) {
    console.error("Backup export error:", error);
    return NextResponse.json({ error: "Backup fehlgeschlagen" }, { status: 500 });
  }
}
