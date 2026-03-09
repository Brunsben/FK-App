// NextAuth wurde durch Portal-JWT-Authentifizierung ersetzt.
// Diese Route ist nicht mehr aktiv.
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    { error: "Authentifizierung erfolgt über das Feuerwehr-Portal." },
    { status: 410 }
  );
}

export function POST() {
  return NextResponse.json(
    { error: "Authentifizierung erfolgt über das Feuerwehr-Portal." },
    { status: 410 }
  );
}
