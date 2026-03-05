import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadedFiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { readAndDecrypt } from "@/lib/encryption";
import { sanitizeFilename } from "@/lib/security";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { id } = await params;

  const file = db.query.uploadedFiles.findFirst({
    where: eq(uploadedFiles.id, id),
  }).sync();

  if (!file) {
    return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
  }

  // Only admin or the file owner can access
  if (session.user.role !== "admin" && file.userId !== session.user.id) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  try {
    const decrypted = readAndDecrypt(file.filePath);

    const safeFilename = sanitizeFilename(file.originalFilename);

    return new NextResponse(new Uint8Array(decrypted), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${safeFilename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Decryption error:", error);
    return NextResponse.json({ error: "Datei konnte nicht entschlüsselt werden" }, { status: 500 });
  }
}
