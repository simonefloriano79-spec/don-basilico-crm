import { NextRequest, NextResponse } from "next/server";
import { impastiDellaSede } from "@/lib/impasti";

// GET /api/impasti?sedeId= — impasti speciali disponibili in una pizzeria (pubblico: serve al sito clienti).
export async function GET(req: NextRequest) {
  const sedeId = req.nextUrl.searchParams.get("sedeId");
  if (!sedeId) return NextResponse.json({ impasti: [] });
  const impasti = await impastiDellaSede(sedeId).catch(() => []);
  return NextResponse.json({ impasti });
}
