// Auth-Session-Typen (Portal-JWT-basiert)
// Die eigentliche Session-Definition liegt in src/lib/auth.ts (AuthSession).
// Diese Datei stellt sicher, dass TS-Importe nicht brechen.

export interface AuthUser {
  id: string;
  name: string;
  role: "admin" | "member";
  consentGiven: boolean;
  mustChangePassword: boolean;
}
