import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compareSync } from "bcryptjs";
import { createHmac } from "crypto";
import { authenticateMember, getMemberView } from "@/lib/db/helpers";
import { loginLimiter, getClientIp } from "@/lib/rate-limit";

/** Portal-JWT validieren (HMAC-SHA256, gleicher JWT_SECRET wie PostgREST) */
function verifyPortalJwt(token: string): { sub: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const expected = createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64url");
    if (expected !== sig) return null;
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    if (!data.sub) return null;
    return { sub: data.sub };
  } catch {
    return null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Anmeldung",
      credentials: {
        username: { label: "Benutzername", type: "text" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials, request) {
        // Rate Limiting für Login-Versuche
        const ip = getClientIp(request);
        const rateLimitResult = loginLimiter.check(ip);
        if (!rateLimitResult.success) {
          console.warn(`Login rate limit exceeded for IP: ${ip}`);
          throw new Error("Zu viele Anmeldeversuche. Bitte warten Sie 15 Minuten.");
        }

        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const username = credentials.username as string;
        const password = credentials.password as string;

        // Authentifizierung gegen fw_common.accounts + fw_common.members
        const user = await authenticateMember(
          username,
          (hash) => compareSync(password, hash)
        );

        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          consentGiven: user.consentGiven,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
    Credentials({
      id: "portal-sso",
      name: "Portal SSO",
      credentials: {
        token: { type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token) return null;
        const payload = verifyPortalJwt(credentials.token as string);
        if (!payload) return null;

        // Benutzer laden – kein Passwort-Check (JWT ist bereits validiert)
        const user = await authenticateMember(payload.sub, () => true);
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          consentGiven: user.consentGiven,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        // Erstmaliger Login — alle Felder setzen
        token.id = user.id!;
        token.name = user.name;
        token.role = user.role;
        token.consentGiven = user.consentGiven;
        token.mustChangePassword = user.mustChangePassword;
      }

      // Bei session.update() vom Client: aktuelle Daten aus DB nachladen
      if (trigger === "update" && token.id) {
        const fresh = await getMemberView(token.id as string);
        if (fresh) {
          token.name = fresh.name;
          token.role = fresh.role;
          token.consentGiven = fresh.consentGiven;
          token.mustChangePassword = fresh.mustChangePassword;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.name = token.name as string;
        session.user.role = token.role;
        session.user.consentGiven = token.consentGiven;
        session.user.mustChangePassword = token.mustChangePassword;
      }
      return session;
    },
  },
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    csrfToken: {
      name: "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
    callbackUrl: {
      name: "next-auth.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
  },
});
