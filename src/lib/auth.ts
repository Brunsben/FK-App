import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ── Portal-JWT-Verifizierung ────────────────────────────────────────────────
// Authentifizierung läuft über das Portal (fw_jwt httpOnly Cookie).
// Kein eigener Login — die FK-App vertraut dem Portal-JWT.

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("FATAL: JWT_SECRET ist nicht gesetzt");
  return new TextEncoder().encode(secret);
}
const COOKIE_NAME = "fw_jwt";

/** Portal-Rolle → FK-App-Rolle (bevorzugt fk_rolle, Fallback app_role) */
function mapRole(payload: Record<string, unknown>): "admin" | "member" | null {
  // Per-App Rolle aus Kameraden-Datensatz (bevorzugt)
  const fkRolle = String(payload.fk_rolle || "");
  if (fkRolle === "Admin" || fkRolle === "Prüfer") return "admin";
  if (fkRolle === "Mitglied") return "member";

  // Fallback: globale Portal-Rolle
  const appRole = String(payload.app_role || "");
  const map: Record<string, "admin" | "member"> = {
    Admin: "admin",
    Gerätewart: "admin",
    Maschinist: "member",
  };
  return map[appRole] ?? null;
}

export interface AuthSession {
  user: {
    id: string;
    name: string;
    role: "admin" | "member";
    consentGiven: boolean;
    mustChangePassword: boolean;
  };
}

/**
 * Liest das Portal-JWT aus dem fw_jwt Cookie, verifiziert es und gibt
 * eine Session zurück. Beim ersten Besuch wird automatisch ein FK-App
 * User-Datensatz angelegt (Auto-Provisioning).
 */
export async function auth(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    // Mitgliedsbezug ist verpflichtend: nur portalweite kamerad_id verwenden.
    const rawKameradId = payload.kamerad_id;
    if (rawKameradId === null || rawKameradId === undefined) return null;
    const kameradId = String(rawKameradId);
    const kameradName = String(
      payload.kamerad_name || payload.sub || "Unbekannt",
    );
    const email = String(
      payload.email || `${String(payload.sub || kameradId)}@portal.local`,
    );

    const fkRole = mapRole(payload as Record<string, unknown>);
    if (!fkRole) return null; // Keine FK-Berechtigung

    // User in FK-App-DB suchen oder automatisch anlegen
    let user = await db.query.users.findFirst({
      where: eq(users.id, kameradId),
    });

    if (!user) {
      await db.insert(users).values({
        id: kameradId,
        email,
        passwordHash: "portal-auth",
        name: kameradName,
        role: fkRole,
        isActive: true,
        consentGiven: true,
        mustChangePassword: false,
      });

      user = await db.query.users.findFirst({ where: eq(users.id, kameradId) });
    } else if (
      user.role !== fkRole ||
      user.name !== kameradName ||
      user.email !== email
    ) {
      // Rolle und Name bei jedem Login aus Portal-JWT synchronisieren
      await db
        .update(users)
        .set({
          role: fkRole,
          name: kameradName,
          email,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, kameradId));
      user = await db.query.users.findFirst({ where: eq(users.id, kameradId) });
    }

    if (!user || !user.isActive) return null;

    return {
      user: {
        id: user.id,
        name: user.name,
        role: user.role as "admin" | "member",
        consentGiven: user.consentGiven,
        mustChangePassword: user.mustChangePassword,
      },
    };
  } catch {
    return null;
  }
}
