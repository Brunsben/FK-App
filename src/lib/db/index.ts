import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// PostgreSQL Verbindung über DATABASE_URL
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL ist nicht gesetzt! Bitte in .env.local konfigurieren.");
}

console.log(`🐘 PostgreSQL: Verbinde...`);

// postgres.js Client – optimiert für Raspberry Pi
const client = postgres(connectionString, {
  max: 10,               // Max 10 parallele Verbindungen
  idle_timeout: 20,      // Idle-Verbindungen nach 20s schließen
  connect_timeout: 10,   // Verbindungsaufbau max 10s
  prepare: false,        // Kompatibilität mit pgBouncer/Supabase
});

// Drizzle ORM Instanz mit allen Schema-Definitionen
export const db = drizzle(client, { schema });
