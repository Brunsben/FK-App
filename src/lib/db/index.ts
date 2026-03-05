import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// Database file location – MUST be absolute to survive standalone mode
function resolveDatabasePath(): string {
  // 1. Explicit env variable (highest priority, always absolute)
  if (process.env.DATABASE_PATH) {
    return path.resolve(process.env.DATABASE_PATH);
  }

  // 2. Derive from PROJECT_ROOT env (set by start scripts)
  if (process.env.PROJECT_ROOT) {
    return path.join(process.env.PROJECT_ROOT, "data", "fuehrerscheinkontrolle.db");
  }

  // 3. Fallback: cwd (works for dev mode + seed script)
  return path.resolve(process.cwd(), "data", "fuehrerscheinkontrolle.db");
}

const DB_PATH = resolveDatabasePath();

// Log the resolved path so we can always verify
console.log(`📀 SQLite DB: ${DB_PATH}`);

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create SQLite connection with WAL mode for better performance
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Export raw sqlite for special operations (e.g. backup)
export const rawDb = sqlite;
