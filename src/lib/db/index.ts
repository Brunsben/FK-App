import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Lazy DB-Initialisierung (verhindert Crash zur Build-Zeit)
let _db: PostgresJsDatabase<typeof schema> & { $client: postgres.Sql } | null = null;

function getDb() {
  if (_db) return _db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL ist nicht gesetzt! Bitte in .env.local konfigurieren.");
  }

  console.log(`🐘 PostgreSQL: Verbinde...`);

  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

  _db = drizzle(client, { schema });
  return _db;
}

// Proxy, der bei jedem Zugriff lazy initialisiert
export const db = new Proxy({} as PostgresJsDatabase<typeof schema> & { $client: postgres.Sql }, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
