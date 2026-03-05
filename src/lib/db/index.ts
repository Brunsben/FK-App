import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// Database file location – configurable via env
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "fuehrerscheinkontrolle.db");

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
