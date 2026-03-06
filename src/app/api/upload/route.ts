import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { licenseChecks, uploadedFiles, memberLicenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encryptAndSave, generateUploadPath } from "@/lib/encryption";
import { logAudit } from "@/lib/audit";
import { uploadLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  // Rate Limiting
  const ip = getClientIp(req);
  const limit = uploadLimiter.check(ip);
  if (!limit.success) return rateLimitResponse(limit.retryAfterMs);

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

    // Dateigröße prüfen
    if (frontFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Datei zu groß (max. 10 MB)" }, { status: 400 });
    }
    if (backFile && backFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Rückseite zu groß (max. 10 MB)" }, { status: 400 });
    }

    // Create a pending check
    const now = new Date();
    const checkDate = now.toISOString().split("T")[0];

    // Calculate next check due
    const memberLicense = await db.query.memberLicenses.findFirst({
      where: eq(memberLicenses.memberId, session.user.id),
    });
    const intervalMonths = memberLicense?.checkIntervalMonths || 6;
    const nextCheckDue = new Date(now);
    nextCheckDue.setMonth(nextCheckDue.getMonth() + intervalMonths);

    // Auto-delete photos after configured days
    const retentionDays = 30; // TODO: from settings
    const autoDeleteAfter = new Date(now);
    autoDeleteAfter.setDate(autoDeleteAfter.getDate() + retentionDays);

    const inserted = await db.insert(licenseChecks)
      .values({
        memberId: session.user.id,
        checkDate,
        checkType: "photo_upload",
        result: "pending",
        nextCheckDue: nextCheckDue.toISOString().split("T")[0],
      })
      .returning({ id: licenseChecks.id });

    const checkId = inserted[0].id;

    // Encrypt and save front side
    const frontBuffer = Buffer.from(await frontFile.arrayBuffer());
    const frontPath = generateUploadPath(session.user.id, "front");
    encryptAndSave(frontBuffer, frontPath);

    await db.insert(uploadedFiles).values({
      checkId,
      memberId: session.user.id,
      filePath: frontPath,
      originalFilename: frontFile.name,
      mimeType: frontFile.type,
      fileSize: frontFile.size,
      side: "front",
      autoDeleteAfter: autoDeleteAfter.toISOString(),
    });

    // Encrypt and save back side (optional)
    if (backFile && allowedTypes.includes(backFile.type)) {
      const backBuffer = Buffer.from(await backFile.arrayBuffer());
      const backPath = generateUploadPath(session.user.id, "back");
      encryptAndSave(backBuffer, backPath);

      await db.insert(uploadedFiles).values({
        checkId,
        memberId: session.user.id,
        filePath: backPath,
        originalFilename: backFile.name,
        mimeType: backFile.type,
        fileSize: backFile.size,
        side: "back",
        autoDeleteAfter: autoDeleteAfter.toISOString(),
      });
    }

    await logAudit({
      memberId: session.user.id,
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
