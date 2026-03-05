import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { licenseClasses } from "@/lib/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const classes = db.query.licenseClasses.findMany({
    orderBy: (c: any, { asc }: any) => [asc(c.sortOrder)],
  }).sync();

  return NextResponse.json(classes);
}
