import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { codiceDaBody, leggiDatiCodice, rigaPerPagina, soloSuperAdmin } from "@/lib/codici-sconto-admin";

export const dynamic = "force-dynamic";

// GET /api/codici-sconto — elenco dei codici con quante volte sono stati usati e quanto hanno scontato (solo super admin).
export async function GET() {
  const a = await soloSuperAdmin();
  if ("errore" in a) return a.errore;

  const [righe, usi] = await Promise.all([
    prisma.codiceSconto.findMany({ orderBy: [{ attivo: "desc" }, { createdAt: "desc" }] }),
    // Gli ordini annullati non contano come utilizzo (il codice torna disponibile).
    prisma.ordine.groupBy({
      by: ["codiceSconto"],
      where: { codiceSconto: { not: null }, stato: { not: "annullato" } },
      _count: { _all: true },
      _sum: { scontoCodice: true },
    }),
  ]);
  const perCodice = new Map(usi.map((u) => [u.codiceSconto as string, { n: u._count._all, tot: Number(u._sum.scontoCodice ?? 0) }]));
  return NextResponse.json(righe.map((r) => rigaPerPagina(r, perCodice.get(r.codice)?.n ?? 0, perCodice.get(r.codice)?.tot ?? 0)));
}

// POST /api/codici-sconto — crea un codice (solo super admin).
export async function POST(req: NextRequest) {
  const a = await soloSuperAdmin();
  if ("errore" in a) return a.errore;

  const body = await req.json().catch(() => ({}));
  const c = codiceDaBody(body);
  if ("errore" in c) return NextResponse.json({ error: c.errore }, { status: 400 });
  const d = leggiDatiCodice(body, true);
  if ("errore" in d) return NextResponse.json({ error: d.errore }, { status: 400 });
  const { dati } = d;
  if (dati.validoDal && dati.validoAl && dati.validoAl < dati.validoDal) {
    return NextResponse.json({ error: "«Valido fino al» deve essere uguale o dopo «valido dal»" }, { status: 400 });
  }
  if (dati.validoAl && dati.validoAl < new Date()) {
    return NextResponse.json({ error: "La data di fine è già passata: il codice nascerebbe scaduto" }, { status: 400 });
  }

  if (await prisma.codiceSconto.findUnique({ where: { codice: c.codice } })) {
    return NextResponse.json({ error: `Il codice ${c.codice} esiste già` }, { status: 409 });
  }

  const creato = await prisma.codiceSconto.create({
    data: {
      codice: c.codice,
      percentuale: dati.percentuale!,
      descrizione: dati.descrizione ?? null,
      validoDal: dati.validoDal ?? null,
      validoAl: dati.validoAl ?? null,
      maxUsiPerCliente: dati.maxUsiPerCliente ?? 1,
      maxUsiTotali: dati.maxUsiTotali ?? null,
      ordineMinimo: dati.ordineMinimo ?? 0,
      soloPrimoOrdine: dati.soloPrimoOrdine ?? false,
      attivo: dati.attivo ?? true,
    },
  });
  return NextResponse.json(rigaPerPagina(creato, 0, 0), { status: 201 });
}
