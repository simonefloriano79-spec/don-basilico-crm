import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificaCodiceOtp } from "@/lib/customer-auth/otp";
import { normalizzaTelefono } from "@/lib/customer-auth/telefono";
import { creaTokenSessione, CUSTOMER_SESSION_COOKIE } from "@/lib/customer-auth/session";

// POST /api/ordina/otp/verifica — verifica il codice ricevuto via SMS.
// Se il codice è corretto, collega (o crea) l'anagrafica cliente per quel
// telefono — stesso pattern di dedup già usato in /api/clienti e
// /api/ordini — e apre la sessione cliente con un cookie firmato.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const telefono = normalizzaTelefono(String(body.telefono ?? ""));
  const codice = String(body.codice ?? "").trim();
  const nome = String(body.nome ?? "").trim();

  if (!telefono || !codice) {
    return NextResponse.json({ error: "Telefono e codice sono richiesti" }, { status: 400 });
  }

  let esito: boolean;
  try {
    esito = await verificaCodiceOtp(telefono, codice);
  } catch (error: any) {
    console.error("Errore verifica OTP", error);
    return NextResponse.json({ error: "Impossibile verificare il codice, riprova" }, { status: 500 });
  }

  if (!esito) {
    return NextResponse.json({ error: "Codice non valido o scaduto" }, { status: 400 });
  }

  let cliente = await prisma.cliente.findFirst({ where: { telefono } });

  if (!cliente) {
    if (!nome) {
      return NextResponse.json({ error: "Nome richiesto per completare la registrazione" }, { status: 400 });
    }
    cliente = await prisma.cliente.create({
      data: { nome, telefono, telefonoVerificatoAt: new Date() },
    });
  } else if (!cliente.telefonoVerificatoAt) {
    cliente = await prisma.cliente.update({
      where: { id: cliente.id },
      data: { telefonoVerificatoAt: new Date() },
    });
  }

  const token = creaTokenSessione(cliente.id);
  const res = NextResponse.json({ ok: true, cliente: { id: cliente.id, nome: cliente.nome } });
  res.cookies.set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 90 * 24 * 60 * 60,
  });
  return res;
}
