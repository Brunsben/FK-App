import { db } from "./index";
import { licenseClasses, users, appSettings } from "./schema";
import { v4 as uuid } from "uuid";
import { hashSync } from "bcryptjs";

/**
 * Seeds the database with default license classes and admin user.
 * Run with: npx tsx src/lib/db/seed.ts
 */
async function seed() {
  console.log("🌱 Seeding database...");

  // ---- License Classes ----
  const defaultClasses = [
    { id: uuid(), code: "B", name: "Klasse B", description: "Kfz bis 3.500 kg, bis 8 Personen + Fahrer", isExpiring: false, defaultCheckIntervalMonths: 6, defaultValidityYears: null, sortOrder: 1 },
    { id: uuid(), code: "BE", name: "Klasse BE", description: "Klasse B + Anhänger über 750 kg", isExpiring: false, defaultCheckIntervalMonths: 6, defaultValidityYears: null, sortOrder: 2 },
    { id: uuid(), code: "C1", name: "Klasse C1", description: "Kfz 3.500 – 7.500 kg", isExpiring: true, defaultCheckIntervalMonths: 6, defaultValidityYears: 5, sortOrder: 3 },
    { id: uuid(), code: "C1E", name: "Klasse C1E", description: "Klasse C1 + Anhänger über 750 kg", isExpiring: true, defaultCheckIntervalMonths: 6, defaultValidityYears: 5, sortOrder: 4 },
    { id: uuid(), code: "C", name: "Klasse C", description: "Kfz über 3.500 kg (Feuerwehr ab 18 mit SZ 188)", isExpiring: true, defaultCheckIntervalMonths: 6, defaultValidityYears: 5, sortOrder: 5 },
    { id: uuid(), code: "CE", name: "Klasse CE", description: "Klasse C + Anhänger über 750 kg", isExpiring: true, defaultCheckIntervalMonths: 6, defaultValidityYears: 5, sortOrder: 6 },
    { id: uuid(), code: "3_ALT", name: "Klasse 3 (alt)", description: "Umschreibung: B, BE, C1, C1E + CE beschränkt (bis 50. Lj.)", isExpiring: true, defaultCheckIntervalMonths: 6, defaultValidityYears: null, sortOrder: 10 },
  ];

  for (const cls of defaultClasses) {
    db.insert(licenseClasses).values(cls).onConflictDoNothing().run();
  }
  console.log(`  ✅ ${defaultClasses.length} Führerscheinklassen angelegt`);

  // ---- Default Admin User ----
  const adminId = uuid();
  const defaultPassword = "admin123"; // Must be changed on first login!
  const passwordHash = hashSync(defaultPassword, 12);

  db.insert(users)
    .values({
      id: adminId,
      email: "admin@feuerwehr.local",
      passwordHash,
      name: "Ortsbrandmeister",
      role: "admin",
      isActive: true,
      mustChangePassword: true,
      consentGiven: false,
    })
    .onConflictDoNothing()
    .run();

  console.log(`  ✅ Admin-Benutzer angelegt (E-Mail: admin@feuerwehr.local, Passwort: ${defaultPassword})`);
  console.log(`  ⚠️  Bitte Passwort beim ersten Login ändern!`);

  // ---- Default Settings ----
  const defaultSettings = [
    { key: "app_name", value: "Führerscheinkontrolle" },
    { key: "organization_name", value: "Freiwillige Feuerwehr" },
    { key: "privacy_policy_version", value: "1.0" },
    { key: "default_check_interval_months", value: "6" },
    { key: "photo_retention_days", value: "30" },
    { key: "reminder_weeks_before", value: "4,1" },
    { key: "smtp_host", value: "" },
    { key: "smtp_port", value: "587" },
    { key: "smtp_user", value: "" },
    { key: "smtp_from", value: "" },
  ];

  for (const setting of defaultSettings) {
    db.insert(appSettings).values(setting).onConflictDoNothing().run();
  }
  console.log(`  ✅ ${defaultSettings.length} Standard-Einstellungen angelegt`);

  console.log("\n🎉 Seed abgeschlossen!");
}

seed().catch(console.error);
