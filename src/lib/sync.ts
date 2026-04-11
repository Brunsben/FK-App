import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const PORTAL_URL = process.env.AUTH_PROXY_URL || "http://portal:8080";
const COOKIE_NAME = "fw_jwt";

/** FK-Rollen-Mapping (Portal fk_rolle → FK-App role) */
function mapFkRolle(fkRolle: string): "admin" | "member" {
  if (fkRolle === "Admin" || fkRolle === "Prüfer") return "admin";
  return "member";
}

export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  deactivated: number;
  total: number;
}

/**
 * Synchronisiert Mitglieder vom Portal (/api/kameraden) in die FK-App DB.
 * Benötigt ein gültiges fw_jwt Token.
 */
export async function syncMembers(token: string): Promise<SyncResult> {
  const res = await fetch(`${PORTAL_URL}/api/kameraden`, {
    headers: { Cookie: `${COOKIE_NAME}=${token}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`Portal-API: HTTP ${res.status}`);
  }

  // Portal gibt Drizzle-Schema-Objekte zurück (camelCase)
  const kameraden: Array<{
    id: number;
    vorname: string | null;
    name: string | null;
    email: string | null;
    fkRolle: string | null;
    aktiv: boolean;
  }> = await res.json();

  const fkMembers = kameraden.filter((k) => k.fkRolle);

  let created = 0;
  let updated = 0;
  let deactivated = 0;
  const syncedIds: string[] = [];

  for (const k of fkMembers) {
    const id = String(k.id);
    syncedIds.push(id);
    const name = [k.vorname, k.name].filter(Boolean).join(" ") || "Unbekannt";
    const email = k.email || `kamerad-${k.id}@portal.local`;
    const role = mapFkRolle(k.fkRolle!);

    const existing = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (existing) {
      await db
        .update(users)
        .set({
          name,
          email,
          role,
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, id));
      updated++;
    } else {
      await db.insert(users).values({
        id,
        email,
        passwordHash: "portal-auth",
        name,
        role,
        isActive: true,
        consentGiven: true,
        mustChangePassword: false,
      });
      created++;
    }
  }

  // Lokale User ohne Portal-FK-Rolle deaktivieren
  if (syncedIds.length > 0) {
    const localUsers = await db.query.users.findMany({
      where: eq(users.isActive, true),
    });
    for (const u of localUsers) {
      if (!syncedIds.includes(u.id) && u.passwordHash === "portal-auth") {
        await db
          .update(users)
          .set({ isActive: false, updatedAt: new Date().toISOString() })
          .where(eq(users.id, u.id));
        deactivated++;
      }
    }
  }

  return {
    success: true,
    created,
    updated,
    deactivated,
    total: fkMembers.length,
  };
}
