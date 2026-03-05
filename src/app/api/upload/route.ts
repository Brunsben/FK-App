import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { licenseChecks, uploadedFiles, memberLicenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { encryptAndSave, generateUploadPath } from "@/lib/encryption";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const frontFile = formData.get("front") as File | null;
    const backFile = formData.get("back") as File | null;

    if (!frontFile) {
      return NextResponse.json({ error: "Vorderseite ist erforderlich" }, { status: 400 });
    }

    // Validate file types
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
    if (!allowedTypes.includes(frontFile.type)) {
      return NextResponse.json({ error: "Nur Bilder (JPEG, PNG, WebP, HEIC) erlaubt" }, { status: 400 });
    }

    // Create a pending check
    const now = new Date();
    const checkDate = now.toISOString().split("T")[0];
    const checkId = uuid();

    // Calculate next check due
    const memberLicense = db.query.memberLicenses.findFirst({
      where: eq(memberLicenses.userId, session.user.id),
    }).sync();
    const intervalMonths = memberLicense?.checkIntervalMonths || 6;
    const nextCheckDue = new Date(now);
    nextCheckDue.setMonth(nextCheckDue.getMonth() + intervalMonths);

    // Auto-delete photos after configured days
    const retentionDays = 30; // TODO: from settings
    const autoDeleteAfter = new Date(now);
    autoDeleteAfter.setDate(autoDeleteAfter.getDate() + retentionDays);

    db.insert(licenseChecks)
      .values({
        id: checkId,
        userId: session.user.id,
        checkDate,
        checkType: "photo_upload",
        result: "pending",
        nextCheckDue: nextCheckDue.toISOString().split("T")[0],
      })
      .run();

    // Encrypt and save front side
    const frontBuffer = Buffer.from(await frontFile.arrayBuffer());
    const frontPath = generateUploadPath(session.user.id, "front");
    encryptAndSave(frontBuffer, frontPath);

    db.insert(uploadedFiles)
      .values({
        id: uuid(),
        checkId,
        userId: session.user.id,
        filePath: frontPath,
        originalFilename: frontFile.name,
        mimeType: frontFile.type,
        fileSize: frontFile.size,
        side: "front",
        autoDeleteAfter: autoDeleteAfter.toISOString(),
      })
      .run();

    // Encrypt and save back side (optional)
    if (backFile && allowedTypes.includes(backFile.type)) {
      const backBuffer = Buffer.from(await backFile.arrayBuffer());
      const backPath = generateUploadPath(session.user.id, "back");
      encryptAndSave(backBuffer, backPath);

      db.insert(uploadedFiles)
        .values({
          id: uuid(),
          checkId,
          userId: session.user.id,
          filePath: backPath,
          originalFilename: backFile.name,
          mimeType: backFile.type,
          fileSize: backFile.size,
          side: "back",
          autoDeleteAfter: autoDeleteAfter.toISOString(),
        })
        .run();
    }

    logAudit({
      userId: session.user.id,
      action: "photo_uploaded",
      entityType: "license_check",
      entityId: checkId,
    });

    return NextResponse.json({ success: true, checkId });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Fehler beim Upload" }, { status: 500 });
  }
}
