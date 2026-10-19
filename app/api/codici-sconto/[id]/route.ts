import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leggiDatiCodice, rigaPerPagina, soloSuperAdmin } from "@/lib/codici-sconto-admin";

const ID = /^[0-9a-f-]{36}$/i;

// PATCH /api/codici-sconto/[id] — modifica un codice o lo attiva/disattiva (solo super admin).
// Il codice (le lettere) non si cambia. La percentuale non si cambia se il codice è già stato usato:
// gli ordini già fatti la ricalcolano se il cliente li modifica, quindi per un'altra percentuale si crea un nuovo codice.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await soloSuperAdmin();
  if ("errore" in a) return a.errore;
  if (!ID.test(params.id)) return NextResponse.json({ error: "Codice non trovato" }, { status: 404 });

  const attuale = await prisma.codiceSconto.findUnique({ where: { id: params.id } });
  if (!attuale) return NextResponse.json({ error: "Codice non trovato" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const d = leggiDatiCodice(body, false);
  if ("errore" in d) return NextResponse.json({ error: d.errore }, { status: 400 });
  const { dati } = d;

  const usiTotali = await prisma.ordine.count({ where: { codiceSconto: attuale.codice } });
  if (dati.percentuale !== undefined && usiTotali > 0 && dati.percentuale !== Number(attuale.percentuale)) {
    return NextResponse.json({ error: "Questo codice è già stato usato: non si può cambiare la percentuale. Disattivalo e creane uno nuovo." }, { status: 409 });
  }

  const dal = dati.validoDal !== undefined ? dati.validoDal : attuale.validoDal;
  const al = dati.validoAl !== undefined ? dati.validoAl : attuale.validoAl;
  if (dal && al && al < dal) return NextResponse.json({ error: "«Valido fino al» deve essere uguale o dopo «valido dal»" }, { status: 400 });

  const aggiornato = await prisma.codiceSconto.update({ where: { id: params.id }, data: dati });
  const attivi = await prisma.ordine.aggregate({
    where: { codiceSconto: aggiornato.codice, stato: { not: "annullato" } },
    _count: { _all: true }, _sum: { scontoCodice: true },
  });
  return NextResponse.json(rigaPerPagina(aggiornato, attivi._count._all, Number(attivi._sum.scontoCodice ?? 0)));
}

// DELETE /api/codici-sconto/[id] — elimina un codice mai usato (solo super admin). Se è stato usato si disattiva: lo storico resta.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const a = await soloSuperAdmin();
  if ("errore" in a) return a.errore;
  if (!ID.test(params.id)) return NextResponse.json({ error: "Codice non trovato" }, { status: 404 });

  const attuale = await prisma.codiceSconto.findUnique({ where: { id: params.id } });
  if (!attuale) return NextResponse.json({ error: "Codice non trovato" }, { status: 404 });

  const usi = await prisma.ordine.count({ where: { codiceSconto: attuale.codice } });
  if (usi > 0) return NextResponse.json({ error: `Il codice è stato usato in ${usi} ordini: non si elimina, si disattiva (lo storico resta).` }, { status: 409 });

  await prisma.codiceSconto.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
