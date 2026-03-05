/**
 * Einfaches In-Memory Rate Limiting für API-Routen.
 * Für den Raspberry Pi mit ~70 Nutzern völlig ausreichend.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

/**
 * Erstellt einen Rate Limiter mit gegebenen Parametern.
 * @param name Eindeutiger Name für den Limiter (z.B. "login", "upload")
 * @param maxRequests Maximale Anfragen pro Fenster
 * @param windowMs Zeitfenster in Millisekunden
 */
export function createRateLimiter(name: string, maxRequests: number, windowMs: number) {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }

  return {
    /**
     * Prüft ob eine IP noch Anfragen stellen darf.
     * @returns { success: true } oder { success: false, retryAfterMs }
     */
    check(ip: string): { success: true } | { success: false; retryAfterMs: number } {
      const store = stores.get(name)!;
      const now = Date.now();
      const entry = store.get(ip);

      // Cleanup: alte Einträge entfernen (alle 100 Checks)
      if (Math.random() < 0.01) {
        for (const [key, val] of store) {
          if (val.resetAt < now) store.delete(key);
        }
      }

      if (!entry || entry.resetAt < now) {
        store.set(ip, { count: 1, resetAt: now + windowMs });
        return { success: true };
      }

      if (entry.count >= maxRequests) {
        return { success: false, retryAfterMs: entry.resetAt - now };
      }

      entry.count++;
      return { success: true };
    },
  };
}

// Vordefinierte Limiter
/** Login: Max 5 Versuche pro 15 Minuten pro IP */
export const loginLimiter = createRateLimiter("login", 5, 15 * 60 * 1000);

/** Passwort ändern: Max 5 Versuche pro 15 Minuten pro IP */
export const passwordLimiter = createRateLimiter("password", 5, 15 * 60 * 1000);

/** Upload: Max 10 pro Stunde pro IP */
export const uploadLimiter = createRateLimiter("upload", 10, 60 * 60 * 1000);

/** Allgemeines API-Limit: Max 100 pro Minute pro IP */
export const apiLimiter = createRateLimiter("api", 100, 60 * 1000);

/**
 * Hilfsfunktion: IP aus dem Request extrahieren
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Hilfsfunktion: Rate-Limit-Fehler als Response
 */
export function rateLimitResponse(retryAfterMs: number) {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return new Response(
    JSON.stringify({
      error: "Zu viele Anfragen. Bitte warte einen Moment.",
      retryAfterSeconds: retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      },
    }
  );
}
