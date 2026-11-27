import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { finestraServizio, giornoServizioOggi } from "@/lib/conti";
import { venditeBanco } from "@/lib/banco-db";
import { SEDI_BANCO, pezziBanco, quantitaValide, totaleBanco } from "@/lib/banco";

export const dynamic = "force-dynamic";

const negato = () => NextResponse.json({ error: "Permesso negato" }, { status: 403 });

// Il super admin lavora sulla sede che indica; gli altri solo sulla propria.
async function utente() {
  const session = await getServerSession(authOptions);
  return session ? (session.user as any) : null;
}
const puo = (user: any, sedeId: string) => user.ruolo === "super_admin" || user.sedeId === sedeId;

// GET /api/banco?sedeId= — le vendite al banco della serata in corso (dalle 5:00).
export async function GET(req: NextRequest) {
  const user = await utente();
  if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const sedeId = req.nextUrl.searchParams.get("sedeId");
  if (!sedeId || !puo(user, sedeId)) return negato();
  const { inizio, fine } = finestraServizio(giornoServizioOggi());
  return NextResponse.json(await venditeBanco(inizio, fine, sedeId));
}

// POST /api/banco { sedeId, margherita, farcito, speciale } — incassa una vendita al banco.
export async function POST(req: NextRequest) {
  const user = await utente();
  if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const sedeId = typeof body.sedeId === "string" ? body.sedeId : "";
  if (!sedeId || !puo(user, sedeId)) return negato();
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { slug: true } });
  if (!sede || !SEDI_BANCO.includes(sede.slug)) {
    return NextResponse.json({ error: "In questa pizzeria non c'è la vendita al banco" }, { status: 400 });
  }
  const q = quantitaValide(body);
  if (!pezziBanco(q)) return NextResponse.json({ error: "Aggiungi almeno un trancio" }, { status: 400 });
  const vendita = await prisma.venditaBanco.create({
    data: { sedeId, ...q, totale: totaleBanco(q), utenteNome: user.name ?? user.email ?? null },
  });
  return NextResponse.json(vendita, { status: 201 });
}

// PATCH /api/banco { id } — annulla una vendita battuta per errore (resta nel database, esce dai conti).
export async function PATCH(req: NextRequest) {
  const user = await utente();
  if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const vendita = typeof body.id === "string" ? await prisma.venditaBanco.findUnique({ where: { id: body.id } }) : null;
  if (!vendita) return NextResponse.json({ error: "Vendita non trovata" }, { status: 404 });
  if (!puo(user, vendita.sedeId)) return negato();
  await prisma.venditaBanco.update({ where: { id: vendita.id }, data: { annullata: true } });
  return NextResponse.json({ ok: true });
}
