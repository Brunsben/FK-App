import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.all-inkl.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false, // STARTTLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return transporter;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: process.env.SMTP_FROM || "Führerscheinkontrolle <noreply@feuerwehr.local>",
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return true;
  } catch (error) {
    console.error("E-Mail-Versand fehlgeschlagen:", error);
    return false;
  }
}

// ---- Email Templates ----

export function checkReminderEmail(name: string, weeksUntilDue: number, appUrl: string): EmailOptions {
  const urgencyText = weeksUntilDue <= 1 ? "⚠️ Dringend" : "📋 Erinnerung";
  return {
    to: "", // Set by caller
    subject: `${urgencyText}: Führerscheinkontrolle fällig`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">🚒 Führerscheinkontrolle</h2>
        <p>Hallo ${name},</p>
        <p>deine Führerscheinkontrolle ist ${weeksUntilDue <= 0 ? "<strong>überfällig</strong>" : `in <strong>${weeksUntilDue} Woche(n)</strong> fällig`}.</p>
        <p>Bitte bringe deinen Führerschein zur nächsten Gelegenheit mit oder lade ein Foto über das Online-Tool hoch:</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${appUrl}/dashboard" style="background-color: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Zur Führerscheinkontrolle</a>
        </p>
        <p style="color: #666; font-size: 0.9em;">Diese E-Mail wurde automatisch versendet. Bei Fragen wende dich an den Ortsbrandmeister.</p>
      </div>
    `,
  };
}

export function licenseExpiryEmail(name: string, licenseClass: string, expiryDate: string, monthsUntilExpiry: number): EmailOptions {
  return {
    to: "",
    subject: `⚠️ Führerschein ${licenseClass} läuft ${monthsUntilExpiry <= 0 ? "AB!" : "bald ab"}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">🚒 Führerschein-Ablaufwarnung</h2>
        <p>Hallo ${name},</p>
        <p>dein Führerschein der <strong>${licenseClass}</strong> ${monthsUntilExpiry <= 0 ? "ist <strong style='color: red;'>abgelaufen</strong>" : `läuft am <strong>${expiryDate}</strong> ab`}.</p>
        <p>${monthsUntilExpiry <= 0 ? "Bitte kümmere dich umgehend um die Verlängerung. Bis dahin darfst du die entsprechenden Fahrzeuge nicht mehr führen!" : "Bitte kümmere dich rechtzeitig um die Verlängerung (ärztliche Untersuchung + Sehtest)."}</p>
        <p style="color: #666; font-size: 0.9em;">Bei Fragen wende dich an den Ortsbrandmeister.</p>
      </div>
    `,
  };
}

export function adminSummaryEmail(
  adminName: string,
  overdueChecks: { name: string; dueDate: string }[],
  upcomingChecks: { name: string; dueDate: string }[],
  expiringLicenses: { name: string; licenseClass: string; expiryDate: string }[],
): EmailOptions {
  return {
    to: "",
    subject: `📊 Wöchentliche Zusammenfassung Führerscheinkontrolle`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">🚒 Wöchentliche Zusammenfassung</h2>
        <p>Hallo ${adminName},</p>

        ${overdueChecks.length > 0 ? `
          <h3 style="color: #dc2626;">🔴 Überfällige Kontrollen (${overdueChecks.length})</h3>
          <ul>${overdueChecks.map((c) => `<li>${c.name} – fällig seit ${c.dueDate}</li>`).join("")}</ul>
        ` : ""}

        ${upcomingChecks.length > 0 ? `
          <h3 style="color: #f59e0b;">🟡 Bald fällige Kontrollen (${upcomingChecks.length})</h3>
          <ul>${upcomingChecks.map((c) => `<li>${c.name} – fällig am ${c.dueDate}</li>`).join("")}</ul>
        ` : ""}

        ${expiringLicenses.length > 0 ? `
          <h3 style="color: #f59e0b;">⚠️ Ablaufende Führerscheine (${expiringLicenses.length})</h3>
          <ul>${expiringLicenses.map((l) => `<li>${l.name} – ${l.licenseClass} läuft ab am ${l.expiryDate}</li>`).join("")}</ul>
        ` : ""}

        ${overdueChecks.length === 0 && upcomingChecks.length === 0 && expiringLicenses.length === 0 ? `
          <p style="color: #16a34a;">✅ Alles in Ordnung – keine offenen Kontrollen oder ablaufenden Führerscheine.</p>
        ` : ""}
      </div>
    `,
  };
}
