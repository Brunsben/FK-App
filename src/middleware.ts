/**
 * Next.js Middleware — Re-exportiert proxy() aus proxy.ts als middleware.
 *
 * Next.js erkennt Middleware NUR wenn:
 * 1. Die Datei `middleware.ts` heißt (in src/ oder root)
 * 2. Sie einen Named Export `middleware` hat
 */
export { proxy as middleware, config } from "./proxy";
