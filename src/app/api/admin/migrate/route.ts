import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { licenseClasses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Migrate – GET und POST unterstützen (GET für Browser-Aufruf)
async function runMigrations() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const added: string[] = [];

  // Feuerwehrführerschein hinzufügen falls nicht vorhanden
  const existingFF = await db.query.licenseClasses.findFirst({
    where: eq(licenseClasses.code, "FF"),
  });

  if (!existingFF) {
    await db.insert(licenseClasses).values({
      code: "FF",
      name: "Feuerwehrführerschein (Nds.)",
      description:
        "Sonderfahrberechtigung gem. §2 Abs. 16 StVG / Nds. – Erlaubt Feuerwehrangehörigen mit Klasse B das Führen von Einsatzfahrzeugen bis 4,75t (bzw. 7,5t mit Einweisung)",
      isExpiring: false,
      defaultCheckIntervalMonths: 0,
      defaultValidityYears: null,
      sortOrder: 14,
    });
    added.push("Feuerwehrführerschein (Nds.)");
  } else {
    // Falls bereits vorhanden: korrigiere Werte
    await db.update(licenseClasses)
      .set({ isExpiring: false, defaultCheckIntervalMonths: 0, defaultValidityYears: null })
      .where(eq(licenseClasses.code, "FF"));
    added.push("Feuerwehrführerschein (Nds.) – aktualisiert");
  }

  return NextResponse.json({
    success: true,
    added,
    message:
      added.length > 0
        ? `Migrationen: ${added.join("; ")}`
        : "Alles aktuell, keine Änderungen nötig.",
  });
}

export async function GET() {
  return runMigrations();
}

export async function POST() {
  return runMigrations();
}
