/**
 * Setup script: creates schema, pushes tables, and seeds initial data.
 * Run with: npx tsx src/lib/db/setup.ts
 */
import { migrateDatabase } from "./migrate";

async function main() {
  console.log("🔧 Setting up database...\n");

  // Step 1: Create schema + indexes
  console.log("📋 Creating schema and indexes...");
  await migrateDatabase();
  console.log("  ✅ Schema ready\n");

  // Step 2: Seed data
  console.log("🌱 Seeding data...");
  await import("./seed");
  console.log("  ✅ Done\n");
}

main().catch((err) => {
  console.error("❌ Setup failed:", err);
  process.exit(1);
});
