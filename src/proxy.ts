import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const basePath = process.env.BASE_PATH || "";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Strip basePath from pathname for route matching
  const path = basePath && pathname.startsWith(basePath)
    ? pathname.slice(basePath.length) || "/"
    : pathname;

  // Public routes – always accessible
  const publicRoutes = ["/login", "/api/auth"];
  const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));

  // Get JWT token – must use same cookie name as auth.ts config
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    cookieName: "next-auth.session-token",
  });
  const isLoggedIn = !!token;

  console.log("[proxy]", { pathname, path, basePath, isPublicRoute, isLoggedIn, url: req.url });

  if (isPublicRoute) {
    if (isLoggedIn && path === "/login") {
      return NextResponse.redirect(new URL(basePath + "/dashboard", req.url));
    }
    console.log("[proxy] → NextResponse.next() (public route)");
    return NextResponse.next();
  }

  // Protected routes – must be logged in
  if (!isLoggedIn) {
    const loginUrl = new URL(basePath + "/login", req.url);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes (Frontend + API)
  if (
    (path.startsWith("/admin") || path.startsWith("/api/admin")) &&
    token.role !== "admin"
  ) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
    }
    return NextResponse.redirect(new URL(basePath + "/dashboard", req.url));
  }

  // Backup API – requires API key
  if (path.startsWith("/api/backup")) {
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
