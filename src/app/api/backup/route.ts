import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, licenseClasses, memberLicenses, licenseChecks, consentRecords, notificationsLog, auditLog, appSettings } from "@/lib/db/schema";

// Protected by middleware (x-api-key header check)
export async function GET() {
  try {
    const backup = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      tables: {
        users: db.select().from(users).all(),
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
