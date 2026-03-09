import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ── Portal-JWT-Verifizierung ────────────────────────────────────────────────
// Authentifizierung läuft über das Feuerwehr-Portal (fw_jwt httpOnly Cookie).
// Kein eigener Login — die FK-App vertraut dem Portal-JWT.

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "");
const COOKIE_NAME = "fw_jwt";

/** Portal-Rolle → FK-App-Rolle */
function mapRole(portalRole: string): "admin" | "member" | null {
  const map: Record<string, "admin" | "member"> = {
    Admin: "admin",
    "Gerätewart": "admin",
    Maschinist: "member",
  };
  return map[portalRole] ?? null;
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
    const { payload } = await jwtVerify(token, JWT_SECRET);
    console.log("[auth] JWT payload:", JSON.stringify(payload));

    const kameradId = String(payload.kamerad_id);
    const kameradName = String(payload.kamerad_name || payload.sub || "Unbekannt");
    const portalRole = String(payload.app_role || "User");

    console.log("[auth] kameradId:", kameradId, "role:", portalRole, "fkRole:", mapRole(portalRole));
    const fkRole = mapRole(portalRole);
    if (!fkRole) return null; // Keine FK-Berechtigung

    // User in FK-App-DB suchen oder automatisch anlegen
    let user = db.query.users
      .findFirst({ where: eq(users.id, kameradId) })
      .sync();

    if (!user) {
      db.insert(users)
        .values({
          id: kameradId,
          email: `${String(payload.sub)}@portal.local`,
          passwordHash: "portal-auth",
          name: kameradName,
          role: fkRole,
          isActive: true,
          consentGiven: true,
          mustChangePassword: false,
        })
        .run();

      user = db.query.users
        .findFirst({ where: eq(users.id, kameradId) })
        .sync();
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
  } catch (err) {
    console.error("[auth] JWT verify error:", err);
    return null;
  }
}
