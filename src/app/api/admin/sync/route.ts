import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, notInArray } from "drizzle-orm";

const AUTH_PROXY_URL = process.env.AUTH_PROXY_URL || "http://auth-proxy:3002";
const COOKIE_NAME = "fw_jwt";

/** FK-Rollen-Mapping (Portal fk_rolle → FK-App role) */
function mapFkRolle(fkRolle: string): "admin" | "member" {
  if (fkRolle === "Admin" || fkRolle === "Prüfer") return "admin";
  return "member";
}

/**
 * POST /api/admin/sync
 * Synchronisiert Mitglieder vom Portal (via auth-proxy /kameraden) in die FK-App SQLite DB.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  // JWT-Cookie lesen und an auth-proxy weiterleiten
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Keine Authentifizierung" }, { status: 401 });
  }

  try {
    // Kameraden vom auth-proxy holen
    const res = await fetch(`${AUTH_PROXY_URL}/kameraden`, {
      headers: { Cookie: `${COOKIE_NAME}=${token}` },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Portal-API: HTTP ${res.status}` }, { status: 502 });
    }

    const kameraden: Array<{
      id: number;
      Vorname: string | null;
      Name: string | null;
      Email: string | null;
      fk_rolle: string | null;
      Aktiv: boolean;
    }> = await res.json();

    // Nur Kameraden mit FK-Berechtigung synchronisieren
    const fkMembers = kameraden.filter((k) => k.fk_rolle);

    let created = 0;
    let updated = 0;
    let deactivated = 0;
    const syncedIds: string[] = [];

    for (const k of fkMembers) {
      const id = String(k.id);
      syncedIds.push(id);
      const name = [k.Vorname, k.Name].filter(Boolean).join(" ") || "Unbekannt";
      const email = k.Email || `kamerad-${k.id}@portal.local`;
      const role = mapFkRolle(k.fk_rolle!);

      const existing = db.query.users.findFirst({ where: eq(users.id, id) }).sync();

      if (existing) {
        db.update(users)
          .set({
            name,
            email,
            role,
            isActive: true,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(users.id, id))
          .run();
        updated++;
      } else {
        db.insert(users)
          .values({
            id,
            email,
            passwordHash: "portal-auth",
            name,
            role,
            isActive: true,
            consentGiven: true,
            mustChangePassword: false,
          })
          .run();
        created++;
      }
    }

    // Lokale User ohne Portal-FK-Rolle deaktivieren
    if (syncedIds.length > 0) {
      const localUsers = db.query.users
        .findMany({ where: eq(users.isActive, true) })
        .sync();
      for (const u of localUsers) {
        if (!syncedIds.includes(u.id) && u.passwordHash === "portal-auth") {
          db.update(users)
            .set({ isActive: false, updatedAt: new Date().toISOString() })
            .where(eq(users.id, u.id))
            .run();
          deactivated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      deactivated,
      total: fkMembers.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: `Sync fehlgeschlagen: ${msg}` }, { status: 500 });
  }
}
