import crypto from "crypto";

/**
 * Generiert ein kryptographisch sicheres temporäres Passwort.
 * Format: 12 Zeichen – Mix aus Buchstaben, Zahlen und einem Sonderzeichen.
 */
export function generateSecurePassword(length: number = 12): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const specials = "!@#$%&*";
  
  let password = "";
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length - 1; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  
  // Mindestens ein Sonderzeichen am Ende
  password += specials[randomBytes[length - 1] % specials.length];
  
  return password;
}

/**
 * Sanitize Dateinamen für Content-Disposition Header.
 * Entfernt gefährliche Zeichen und verhindert Header-Injection.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^\w\s.\-äöüÄÖÜß]/gi, "_")
    .replace(/\s+/g, "_")
    .slice(0, 255);
}
