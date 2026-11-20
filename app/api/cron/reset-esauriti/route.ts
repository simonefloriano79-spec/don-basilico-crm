import { NextRequest, NextResponse } from "next/server";
import { resetEsauritiScaduti } from "@/lib/esauriti";

export const dynamic = "force-dynamic";

// GET /api/cron/reset-esauriti — chiamato ogni mattina da Vercel (vedi vercel.json): rimette disponibili i prodotti
// segnati «Esaurito» nei giorni precedenti. È sicuro anche se lo chiama qualcun altro: tocca solo i prodotti già scaduti.
export async function GET(req: NextRequest) {
  const segreto = process.env.CRON_SECRET;
  if (segreto && req.headers.get("authorization") !== `Bearer ${segreto}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const n = await resetEsauritiScaduti({ forza: true });
  return NextResponse.json({ ok: true, riattivati: n });
}
