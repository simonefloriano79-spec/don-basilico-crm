import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clienteIdDaRichiesta } from "@/lib/customer-auth/session";
import { assicuraTessera, statoTessera, TIMBRI_PER_CICLO } from "@/lib/fedelta";

async function clienteCollegato(req: NextRequest) {
  const clienteId = clienteIdDaRichiesta(req);
  if (!clienteId) return null;
  return prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { nome: true, telefono: true, privacyAt: true, marketingAt: true },
  });
}

// GET /api/ordina/tessera — stato della tessera fedeltà del cliente collegato (timbri, sconto, premi) e, per la
// pagina "La mia tessera", gli stessi dati della tessera che si apre dal QR (stessa funzione del database).
export async function GET(req: NextRequest) {
  const cliente = await clienteCollegato(req);
  if (!cliente?.telefono) return NextResponse.json({ tessera: null });

  const stato = await statoTessera(cliente.telefono).catch(() => null);
  if (!stato) return NextResponse.json({ tessera: null, scheda: null, perCiclo: TIMBRI_PER_CICLO });

  let scheda: any = null;
  try {
    const r = await prisma.$queryRaw<{ j: string }[]>`SELECT fedelta.card_payload(${stato.token})::text AS j`;
    const c = JSON.parse(r[0].j);
    scheda = {
      token: stato.token,
      nome: c.customer.nome,
      pizzeria: c.customer.pizzeria_nome,
      ciclo: c.card.currentCycle,
      timbri: c.card.stampsCount,
      totaleCiclo: Number(c.card.totalCurrentCycle),
      scontoDisponibile: !!c.card.discountAvailable,
      compleannoDisponibile: !!c.card.birthdayDiscountAvailable,
      magliaDisponibile: !!c.card.magliaAvailable,
      ordini: (c.card.currentCycleOrders ?? []).map((o: any) => ({ posizione: Number(o.posizione), importo: Number(o.importo) })),
    };
  } catch (e) {
    console.error("Lettura scheda tessera non riuscita", e);
  }

  return NextResponse.json({
    perCiclo: TIMBRI_PER_CICLO,
    tessera: {
      token: stato.token,
      timbri: stato.timbri,
      totaleCiclo: stato.totaleCiclo,
      scontoDisponibile: stato.scontoDisponibile,
      importoSconto: stato.importoSconto,
    },
    scheda,
  });
}

// POST /api/ordina/tessera — attiva la tessera (se non c'è già) scegliendo la pizzeria di riferimento.
// Il consenso alla privacy è già stato dato alla registrazione.
export async function POST(req: NextRequest) {
  const cliente = await clienteCollegato(req);
  if (!cliente?.telefono) return NextResponse.json({ error: "Sessione scaduta, accedi di nuovo" }, { status: 401 });
  if (!cliente.privacyAt) return NextResponse.json({ error: "Prima accetta l'informativa privacy" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const sedeSlug = String(body.sedeSlug ?? "");
  await assicuraTessera(prisma, {
    nome: cliente.nome, telefono: cliente.telefono, sedeSlug,
    marketing: !!cliente.marketingAt, consensoAt: cliente.privacyAt,
  });
  const stato = await statoTessera(cliente.telefono);
  if (!stato) return NextResponse.json({ error: "Pizzeria non valida" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
