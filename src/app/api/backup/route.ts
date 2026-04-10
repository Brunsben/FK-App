import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, licenseClasses, memberLicenses, licenseChecks, consentRecords, notificationsLog, auditLog, appSettings } from "@/lib/db/schema";
import crypto from "crypto";

// Protected by proxy (x-api-key header check)
export async function GET(req: Request) {
  // Zusätzliche API-Key-Prüfung (Defense in Depth)
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = process.env.BACKUP_API_KEY;
  if (!expectedKey || expectedKey.includes("CHANGE_ME") || !apiKey ||
      apiKey.length !== expectedKey.length ||
      !crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(expectedKey))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Users OHNE passwordHash exportieren
    const allUsers = await db.select().from(users);
    const safeUsers = allUsers.map(({ passwordHash: _pw, ...rest }) => rest);

    const backup = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      tables: {
        users: safeUsers,
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
