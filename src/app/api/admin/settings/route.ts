import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

// GET all settings
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const settings = await db.query.appSettings.findMany();

  // In ein Key-Value Object umwandeln
  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    settingsMap[s.key] = s.value;
  }

  return NextResponse.json(settingsMap);
}

// PUT update settings
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const body = await req.json();

  const allowedKeys = [
    "check_interval_months",
    "reminder_weeks_before",
    "reminder_weeks_before_2",
    "license_expiry_warning_months",
    "photo_auto_delete_days",
    "privacy_policy_version",
    "fire_department_name",
  ];

  const updates: { key: string; oldValue: string; newValue: string }[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (!allowedKeys.includes(key)) continue;

    // Alten Wert lesen
    const existing = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, key),
    });
    const oldValue = existing?.value || "";

    if (oldValue === String(value)) continue; // Keine Änderung

    // Upsert
    if (existing) {
      await db.update(appSettings)
        .set({ value: String(value) })
        .where(eq(appSettings.key, key));
    } else {
      await db.insert(appSettings)
        .values({ key, value: String(value) });
    }

    updates.push({ key, oldValue, newValue: String(value) });
  }

  if (updates.length > 0) {
    await logAudit({
      memberId: session.user.id,
      action: "settings_updated",
      entityType: "app_settings",
      entityId: "global",
      details: { updates },
    });
  }

  return NextResponse.json({
    success: true,
    updatedCount: updates.length,
  });
}
