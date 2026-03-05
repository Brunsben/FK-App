import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, licenseClasses, memberLicenses, licenseChecks, consentRecords, notificationsLog, auditLog, appSettings } from "@/lib/db/schema";

// Protected by proxy (x-api-key header check)
export async function GET(req: Request) {
  // Zusätzliche API-Key-Prüfung (Defense in Depth)
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = process.env.BACKUP_API_KEY;
  if (!expectedKey || expectedKey.includes("CHANGE_ME") || apiKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Users OHNE passwordHash exportieren
    const allUsers = db.select().from(users).all();
    const safeUsers = allUsers.map(({ passwordHash: _pw, ...rest }) => rest);

    const backup = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      tables: {
        users: safeUsers,
        licenseClasses: db.select().from(licenseClasses).all(),
        memberLicenses: db.select().from(memberLicenses).all(),
        licenseChecks: db.select().from(licenseChecks).all(),
        consentRecords: db.select().from(consentRecords).all(),
        notificationsLog: db.select().from(notificationsLog).all(),
        auditLog: db.select().from(auditLog).all(),
        appSettings: db.select().from(appSettings).all(),
      },
    };

    return NextResponse.json(backup);
  } catch (error) {
    console.error("Backup export error:", error);
    return NextResponse.json({ error: "Backup fehlgeschlagen" }, { status: 500 });
  }
}
