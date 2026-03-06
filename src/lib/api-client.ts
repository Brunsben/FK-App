/**
 * Client-seitige API-Hilfsfunktionen.
 * Stellt sicher, dass fetch()-Aufrufe den Next.js basePath (/fk) enthalten.
 * 
 * Next.js fügt den basePath automatisch bei <Link> und router.push() hinzu,
 * aber NICHT bei fetch() — das ist raw Browser-API.
 */

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Baut eine API-URL mit basePath: apiUrl("/api/user/consent") → "/fk/api/user/consent" */
export function apiUrl(path: string): string {
  return `${basePath}${path}`;
}

/** Baut eine Seiten-URL mit basePath: pageUrl("/login") → "/fk/login" */
export function pageUrl(path: string): string {
  return `${basePath}${path}`;
}
