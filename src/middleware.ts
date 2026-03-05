import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes – always accessible
  const publicRoutes = ["/login", "/api/auth"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Get JWT token (does NOT need DB/Node.js access – works in Edge Runtime)
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const isLoggedIn = !!token;

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

  // Must change password → redirect to password change page (but allow the API!)
  if (token.mustChangePassword && pathname !== "/passwort-aendern" && !pathname.startsWith("/api/user/change-password")) {
    return NextResponse.redirect(new URL("/passwort-aendern", req.url));
  }

  // Must give consent → redirect to consent page (but allow the API!)
  if (!token.consentGiven && pathname !== "/datenschutz-einwilligung" && pathname !== "/passwort-aendern" && !pathname.startsWith("/api/user/consent")) {
    return NextResponse.redirect(new URL("/datenschutz-einwilligung", req.url));
  }

  // Admin-only routes
  if (pathname.startsWith("/admin") && token.role !== "admin") {
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
