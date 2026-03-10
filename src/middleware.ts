import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "");
const COOKIE_NAME = "fw_jwt";

// Öffentliche Pfade, die keinen Auth-Check brauchen
const PUBLIC_PATHS = ["/login", "/api/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Statische Assets und öffentliche Pfade durchlassen
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/fk/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Prüfen ob FK-Berechtigung vorhanden
    const fkRolle = String(payload.fk_rolle || "");
    const appRole = String(payload.app_role || "");
    const hasAccess =
      ["Admin", "Prüfer", "Mitglied"].includes(fkRolle) ||
      ["Admin", "Gerätewart", "Maschinist"].includes(appRole);

    if (!hasAccess) {
      return NextResponse.redirect(new URL("/fk/login", request.url));
    }

    return NextResponse.next();
  } catch {
    // Ungültiger/abgelaufener Token → Login
    return NextResponse.redirect(new URL("/fk/login", request.url));
  }
}

export const config = {
  // basePath /fk wird von Next.js automatisch vorangestellt,
  // daher hier relative Pfade ohne /fk
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
