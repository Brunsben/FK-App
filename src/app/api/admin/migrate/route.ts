import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, rawDb } from "@/lib/db";
import { licenseClasses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// POST – run migrations (admin only)
export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const added: string[] = [];

  // Feuerwehrführerschein hinzufügen falls nicht vorhanden
  const existingFF = db.query.licenseClasses
    .findFirst({ where: eq(licenseClasses.code, "FF") })
    .sync();

  if (!existingFF) {
    db.insert(licenseClasses)
      .values({
        id: uuid(),
        code: "FF",
        name: "Feuerwehrführerschein (Nds.)",
        description:
          "Sonderfahrberechtigung gem. §2 Abs. 16 StVG / Nds. – Erlaubt Feuerwehrangehörigen mit Klasse B das Führen von Einsatzfahrzeugen bis 4,75t (bzw. 7,5t mit Einweisung)",
        isExpiring: false,
        defaultCheckIntervalMonths: 0,
        defaultValidityYears: null,
        sortOrder: 14,
      })
      .run();
    added.push("Feuerwehrführerschein (Nds.)");
  } else {
    // Falls bereits vorhanden: korrigiere Werte
    db.update(licenseClasses)
      .set({ isExpiring: false, defaultCheckIntervalMonths: 0, defaultValidityYears: null })
      .where(eq(licenseClasses.code, "FF"))
      .run();
    added.push("Feuerwehrführerschein (Nds.) – aktualisiert");
  }

  // Fix: Kaputte datetime-Literale in bestehenden Daten reparieren
  const sqlite = rawDb;
  const fixedTables = [];
  const tables = [
    { name: "users", cols: ["created_at", "updated_at"] },
    { name: "member_licenses", cols: ["created_at"] },
    { name: "license_checks", cols: ["created_at"] },
    { name: "uploaded_files", cols: ["uploaded_at"] },
    { name: "consent_records", cols: ["created_at"] },
    { name: "notifications_log", cols: ["sent_at"] },
    { name: "audit_log", cols: ["created_at"] },
  ];
  for (const t of tables) {
    for (const col of t.cols) {
      const result = sqlite.prepare(
        `UPDATE ${t.name} SET ${col} = datetime('now') WHERE ${col} LIKE '%(datetime%' OR ${col} IS NULL`
      ).run();
      if (result.changes > 0) {
        fixedTables.push(`${t.name}.${col}: ${result.changes} Zeilen`);
      }
    }
  }

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
