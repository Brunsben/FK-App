import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, memberLicenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { hashSync } from "bcryptjs";
import { logAudit } from "@/lib/audit";

// GET all members (admin only)
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const allMembers = db.query.users.findMany({
    where: eq(users.isActive, true),
    with: {
      memberLicenses: {
        with: { licenseClass: true },
      },
    },
    orderBy: (u: any, { asc }: any) => [asc(u.name)],
  }).sync();

  return NextResponse.json(allMembers);
}

// POST create new member
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, dateOfBirth, phone, role, licenses, generatePassword } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Name und E-Mail sind erforderlich." }, { status: 400 });
  }

  // Check if email already exists
  const existing = db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase().trim()),
  }).sync();
  if (existing) {
    return NextResponse.json({ error: "Diese E-Mail-Adresse ist bereits vergeben." }, { status: 400 });
  }

  // Generate a random initial password
  const tempPassword = generatePassword || Math.random().toString(36).slice(-10) + "A1!";
  const passwordHash = hashSync(tempPassword, 12);

  const userId = uuid();

  db.insert(users)
    .values({
      id: userId,
      email: email.toLowerCase().trim(),
      passwordHash,
      name,
      dateOfBirth: dateOfBirth || null,
      phone: phone || null,
      role: role || "member",
      isActive: true,
      mustChangePassword: true,
      consentGiven: false,
    })
    .run();

  // Add license classes if provided
  if (licenses && Array.isArray(licenses)) {
    for (const lic of licenses) {
      db.insert(memberLicenses)
        .values({
          id: uuid(),
          userId,
          licenseClassId: lic.licenseClassId,
          issueDate: lic.issueDate || null,
          expiryDate: lic.expiryDate || null,
          checkIntervalMonths: lic.checkIntervalMonths || 6,
          restriction188: lic.restriction188 || false,
          notes: lic.notes || null,
        })
        .run();
    }
  }

  logAudit({
    userId: session.user.id,
    action: "member_created",
    entityType: "user",
    entityId: userId,
    details: { name, email, role: role || "member" },
  });

  return NextResponse.json({
    success: true,
    userId,
    tempPassword, // Admin can share this with the member
  });
}
