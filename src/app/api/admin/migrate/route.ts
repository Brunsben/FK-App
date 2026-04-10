import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { licenseClasses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// Migrate – GET und POST unterstützen (GET für Browser-Aufruf)
async function runMigrations() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const added: string[] = [];

  // Feuerwehrführerschein hinzufügen falls nicht vorhanden
  const existingFF = await db.query.licenseClasses
    .findFirst({ where: eq(licenseClasses.code, "FF") });

  if (!existingFF) {
    await db.insert(licenseClasses)
      .values({
        id: uuid(),
        code: "FF",
        name: "Feuerwehrführerschein",
        description:
          "Sonderfahrberechtigung gem. §2 Abs. 16 StVG – Erlaubt Feuerwehrangehörigen mit Klasse B das Führen von Einsatzfahrzeugen bis 4,75t (bzw. 7,5t mit Einweisung)",
        isExpiring: false,
        defaultCheckIntervalMonths: 0,
        defaultValidityYears: null,
        sortOrder: 14,
      });
    added.push("Feuerwehrführerschein");
  } else {
    // Falls bereits vorhanden: korrigiere Werte
    await db.update(licenseClasses)
      .set({
        isExpiring: false,
        defaultCheckIntervalMonths: 0,
        defaultValidityYears: null,
      })
      .where(eq(licenseClasses.code, "FF"));
    added.push("Feuerwehrführerschein – aktualisiert");
  }

  // Date fix removed (was SQLite-specific)
  const fixedTables: string[] = [];

  return NextResponse.json({
    success: true,
    added,
    fixedDates: fixedTables,
    message:
      [...added, ...fixedTables].length > 0
        ? `Migrationen: ${[...added, ...fixedTables].join("; ")}`
        : "Alles aktuell, keine Änderungen nötig.",
  });
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const limit = apiLimiter.check(ip);
  if (!limit.success) return rateLimitResponse(limit.retryAfterMs);

  return runMigrations();
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = apiLimiter.check(ip);
  if (!limit.success) return rateLimitResponse(limit.retryAfterMs);

  return runMigrations();
}
