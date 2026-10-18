import { NextResponse } from "next/server";
import { chiavePubblicaPush } from "@/lib/push";

// GET /api/ordina/push/chiave — chiave pubblica per iscrivere il telefono alle notifiche (non è un segreto).
export async function GET() {
  const chiave = chiavePubblicaPush();
  return NextResponse.json({ chiave }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
