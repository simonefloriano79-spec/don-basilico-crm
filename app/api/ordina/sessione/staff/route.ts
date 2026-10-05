import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { creaTokenSessione, CUSTOMER_SESSION_COOKIE } from "@/lib/customer-auth/session";

// POST /api/ordina/sessione/staff — "modalità prova" per chi lavora nel CRM (beta): chi ha già fatto il login
// al CRM entra nel sito clienti senza codice SMS, con un cliente di prova dedicato ("PROVA <nome>", numero
// fittizio +39000…). Serve a provare l'ordine online senza dipendere da Twilio. Non apre nulla al pubblico:
// senza il login CRM questa route risponde 401.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Serve il login del CRM" }, { status: 401 });
  const user = session.user as any;

  const cifre = String(parseInt(createHash("sha1").update(String(user.id ?? user.email ?? user.name)).digest("hex").slice(0, 8), 16) % 10_000_000).padStart(7, "0");
  const telefono = `+39000${cifre}`;
  const nome = `PROVA ${user.name ?? "staff"}`;

  let cliente = await prisma.cliente.findFirst({ where: { telefono } });
  if (!cliente) {
    cliente = await prisma.cliente.create({ data: { nome, telefono, telefonoVerificatoAt: new Date(), privacyAt: new Date(), note: "Cliente di prova (modalità staff beta)" } });
  } else if (!cliente.privacyAt) {
    cliente = await prisma.cliente.update({ where: { id: cliente.id }, data: { privacyAt: new Date() } });
  }

  const res = NextResponse.json({ ok: true, cliente: { id: cliente.id, nome: cliente.nome, telefono: cliente.telefono, indirizzoDefault: cliente.indirizzoDefault, privacyOk: true } });
  res.cookies.set(CUSTOMER_SESSION_COOKIE, creaTokenSessione(cliente.id), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 12 * 60 * 60, // 12 ore: è solo una prova
  });
  return res;
}
