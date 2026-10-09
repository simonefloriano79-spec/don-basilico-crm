import { NextRequest, NextResponse } from "next/server";
import { inviaCodiceOtp } from "@/lib/customer-auth/otp";
import { normalizzaTelefono } from "@/lib/customer-auth/telefono";
import { controllaERegistraRichiestaOtp } from "@/lib/limite-otp";

// Connessione del cliente (Vercel la mette in questi intestazioni).
function ipRichiesta(req: NextRequest): string | null {
  const diretto = req.headers.get("x-real-ip");
  const inoltrato = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return diretto || inoltrato || null;
}

// POST /api/ordina/otp/richiedi — invia un codice OTP via SMS al telefono indicato.
// Solo cellulari italiani (+39 3…) e con limiti di frequenza: ogni SMS costa, e senza controlli qualcuno potrebbe
// farci spendere chiedendo codici verso numeri esteri o a raffica.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const telefono = normalizzaTelefono(String(body.telefono ?? ""));

  if (!telefono) {
    return NextResponse.json({ error: "Numero di telefono non valido" }, { status: 400 });
  }
  if (!/^\+393\d{8,9}$/.test(telefono)) {
    return NextResponse.json({ error: "Per ora si può registrare solo un numero di cellulare italiano" }, { status: 400 });
  }

  const limite = await controllaERegistraRichiestaOtp(telefono, ipRichiesta(req));
  if (!limite.ok) {
    return NextResponse.json({ error: limite.messaggio }, { status: 429 });
  }

  try {
    await inviaCodiceOtp(telefono);
    return NextResponse.json({ ok: true, telefono });
  } catch (error: any) {
    console.error("Errore invio OTP", error);
    return NextResponse.json({ error: "Impossibile inviare il codice, riprova tra poco" }, { status: 500 });
  }
}
