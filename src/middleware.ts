import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "");
const COOKIE_NAME = "fw_jwt";

async function getPortalUser(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const fkRolle = String(payload.fk_rolle || "");
    const appRole = String(payload.app_role || "");
    // FK-Berechtigung prüfen: per-App Rolle oder Fallback über globale Rolle
    const hasAccess =
      ["Admin", "Prüfer", "Mitglied"].includes(fkRolle) ||
      ["Admin", "Gerätewart", "Maschinist"].includes(appRole);
    if (!hasAccess) return null;
    return {
      sub: payload.sub as string,
      app_role: payload.app_role as string,
      kamerad_id: payload.kamerad_id as number,
      fk_rolle: fkRolle,
    };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes – always accessible
  const publicRoutes = ["/login", "/api/auth"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  const user = await getPortalUser(req);
  const isLoggedIn = !!user;

  if (isPublicRoute) {
    if (isLoggedIn && pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Protected routes – must be logged in
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes (Frontend + API)
  const isAdmin =
    user.fk_rolle === "Admin" || user.fk_rolle === "Prüfer" ||
    user.app_role === "Admin" || user.app_role === "Gerätewart";
  if (
    (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) &&
    !isAdmin
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Backup API – requires API key
  if (pathname.startsWith("/api/backup")) {
    const apiKey = req.headers.get("x-api-key");
    if (apiKey !== process.env.BACKUP_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)",
  ],
};
