import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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
        isExpiring: true,
        defaultCheckIntervalMonths: 0,
        defaultValidityYears: 5,
        sortOrder: 14,
      })
      .run();
    added.push("Feuerwehrführerschein (Nds.)");
  }

  return NextResponse.json({
    success: true,
    added,
    message:
      added.length > 0
        ? `${added.length} neue Klasse(n) hinzugefügt: ${added.join(", ")}`
        : "Alles aktuell, keine Änderungen nötig.",
  });
}
