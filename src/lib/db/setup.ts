/**
 * Setup script: creates tables and seeds initial data.
 * Run with: npx tsx src/lib/db/setup.ts
 */
import { migrateDatabase } from "./migrate";

console.log("🔧 Setting up database...\n");

// Step 1: Create tables
console.log("📋 Creating tables...");
migrateDatabase();
console.log("  ✅ Tables created\n");

// Step 2: Seed data
console.log("🌱 Seeding data...");
// Import seed dynamically to run after tables are created
import("./seed");
