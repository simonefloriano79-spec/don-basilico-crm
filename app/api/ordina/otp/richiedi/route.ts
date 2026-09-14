import { NextRequest, NextResponse } from "next/server";
import { inviaCodiceOtp } from "@/lib/customer-auth/otp";
import { normalizzaTelefono } from "@/lib/customer-auth/telefono";

// POST /api/ordina/otp/richiedi — invia un codice OTP via SMS al telefono indicato.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const telefono = normalizzaTelefono(String(body.telefono ?? ""));

  if (!telefono) {
    return NextResponse.json({ error: "Numero di telefono non valido" }, { status: 400 });
  }

  try {
    await inviaCodiceOtp(telefono);
    return NextResponse.json({ ok: true, telefono });
  } catch (error: any) {
    console.error("Errore invio OTP", error);
    return NextResponse.json({ error: "Impossibile inviare il codice, riprova tra poco" }, { status: 500 });
  }
}
