import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dataValida, finestraServizio, giornoServizioOggi } from "@/lib/conti";

export const dynamic = "force-dynamic";

const num = (d: any): number => Number(d?.toString?.() ?? d ?? 0) || 0;
const r2 = (n: number) => Math.round(n * 100) / 100;

type Consegna = { ordineId: string; stato: string; consegnataAt: Date | null; fattorinoId: string | null; fattorinoNome: string | null };

// GET /api/conti?data=YYYY-MM-DD&sedeId=xxx|tutte
// Conti di una serata (dalle 5:00 alle 5:00 del giorno dopo): domicilio (con i rider), asporto, tavolo, Just Eat e totale.
// Super admin: una sede a scelta o tutte; gli altri: sempre e solo la propria sede.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;
  const { searchParams } = new URL(req.url);

  const superAdmin = user.ruolo === "super_admin";
  if (!superAdmin && !user.sedeId) return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  const sedeParam = searchParams.get("sedeId");
  const sedeFiltro: string | undefined = superAdmin ? (sedeParam && sedeParam !== "tutte" ? sedeParam : undefined) : user.sedeId;

  const dataParam = searchParams.get("data");
  const { data, inizio, fine } = finestraServizio(dataValida(dataParam) ? dataParam : giornoServizioOggi());

  const ordini = await prisma.ordine.findMany({
    where: { ...(sedeFiltro && { sedeId: sedeFiltro }), createdAt: { gte: inizio, lt: fine }, stato: { not: "annullato" } },
    select: {
      id: true, numeroOrdine: true, sedeId: true, tipo: true, canale: true, stato: true, totale: true, costoConsegna: true,
      metodoPagamento: true, clienteNome: true, clienteIndirizzo: true, createdAt: true, sede: { select: { nome: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Chi ha consegnato (tabella `consegne` dell'app dei rider, stesso database): sola lettura.
  const idDomicilio = ordini.filter((o) => o.tipo === "domicilio").map((o) => o.id);
  const consegne = new Map<string, Consegna>();
  let consegneOk = true;
  if (idDomicilio.length) {
    try {
      const righe = await prisma.$queryRaw<Consegna[]>`
        SELECT c.ordine_id::text AS "ordineId", c.stato::text AS "stato", c.consegnata_at AS "consegnataAt",
               f.id::text AS "fattorinoId", f.nome AS "fattorinoNome"
        FROM consegne c LEFT JOIN fattorini f ON f.id = c.fattorino_id
        WHERE c.ordine_id = ANY(${idDomicilio}::uuid[])
      `;
      righe.forEach((r) => consegne.set(r.ordineId, r));
    } catch (e: any) {
      consegneOk = false;
      console.error("Conti: tabella consegne non leggibile:", e?.message ?? e);
    }
  }

  const dto = ordini.map((o) => {
    const c = consegne.get(o.id);
    return {
      id: o.id, numero: o.numeroOrdine, ora: o.createdAt, sedeId: o.sedeId, sede: o.sede?.nome ?? "", tipo: o.tipo, canale: o.canale,
      stato: o.stato, totale: num(o.totale), costoConsegna: num(o.costoConsegna),
      // L'app clienti salva «carta», la cassa «pos»: per i conti sono la stessa cosa (carta al rider con il POS).
      metodo: o.metodoPagamento === "carta" ? "pos" : o.metodoPagamento,
      cliente: o.clienteNome, indirizzo: o.clienteIndirizzo,
      riderId: c?.fattorinoId ?? null, riderNome: c?.fattorinoNome ?? null, consegnaStato: c?.stato ?? null, consegnataAt: c?.consegnataAt ?? null,
    };
  });

  // ── DOMICILIO: per rider ─────────────────────────────────────────────────────────────
  const dom = dto.filter((o) => o.tipo === "domicilio");
  type Gruppo = {
    riderId: string | null; nome: string; consegne: number; totale: number; costoConsegna: number; contanti: number; pos: number;
    contantiDaVersare: number; contantiNonChiusi: number; nonChiuse: number; ordini: typeof dto;
  };
  const gruppi = new Map<string, Gruppo>();
  const totDom = { ordini: 0, totale: 0, costoConsegna: 0, contanti: 0, pos: 0, senzaMetodo: 0, contantiDaVersare: 0, contantiNonChiusi: 0, nonChiuse: 0, senzaRider: 0 };
  for (const o of dom) {
    const chiave = o.riderId ?? "nessuno";
    let g = gruppi.get(chiave);
    if (!g) {
      g = {
        riderId: o.riderId, nome: o.riderId ? (o.riderNome ?? "Rider") : "Senza rider", consegne: 0, totale: 0, costoConsegna: 0, contanti: 0, pos: 0,
        contantiDaVersare: 0, contantiNonChiusi: 0, nonChiuse: 0, ordini: [],
      };
      gruppi.set(chiave, g);
    }
    const chiusa = o.consegnaStato === "consegnata";
    g.consegne++; g.totale += o.totale; g.costoConsegna += o.costoConsegna; g.ordini.push(o);
    totDom.ordini++; totDom.totale += o.totale; totDom.costoConsegna += o.costoConsegna;
    if (o.metodo === "contanti") {
      g.contanti += o.totale; totDom.contanti += o.totale;
      if (chiusa) { g.contantiDaVersare += o.totale; totDom.contantiDaVersare += o.totale; }
      else { g.contantiNonChiusi += o.totale; totDom.contantiNonChiusi += o.totale; }
    } else if (o.metodo === "pos") { g.pos += o.totale; totDom.pos += o.totale; }
    else totDom.senzaMetodo += o.totale;
    if (o.riderId && !chiusa) { g.nonChiuse++; totDom.nonChiuse++; }
    if (!o.riderId) totDom.senzaRider++;
  }
  const rider = Array.from(gruppi.values())
    .sort((a, b) => (a.riderId === null ? 1 : 0) - (b.riderId === null ? 1 : 0) || a.nome.localeCompare(b.nome))
    .map((g) => ({
      ...g, totale: r2(g.totale), costoConsegna: r2(g.costoConsegna), contanti: r2(g.contanti), pos: r2(g.pos),
      contantiDaVersare: r2(g.contantiDaVersare), contantiNonChiusi: r2(g.contantiNonChiusi),
    }));

  // ── ASPORTO e TAVOLO ─────────────────────────────────────────────────────────────────
  const somma = (lista: typeof dto) => ({ ordini: lista.length, totale: r2(lista.reduce((a, o) => a + o.totale, 0)) });
  const asp = dto.filter((o) => o.tipo === "asporto");
  const tav = dto.filter((o) => o.tipo === "tavolo");
  const perCanale = (["walk_in", "telefono", "online"] as const).map((c) => ({ canale: c, ...somma(asp.filter((o) => o.canale === c)) }));

  // ── JUST EAT (inserito a mano) ───────────────────────────────────────────────────────
  let je = { ok: true, giaPagato: 0, contanti: 0, modificatoDa: null as string | null, modificatoAt: null as Date | null };
  try {
    const righe = await prisma.contiJe.findMany({ where: { giorno: new Date(data + "T00:00:00Z"), ...(sedeFiltro && { sedeId: sedeFiltro }) } });
    je = {
      ok: true,
      giaPagato: r2(righe.reduce((a, r) => a + num(r.giaPagato), 0)),
      contanti: r2(righe.reduce((a, r) => a + num(r.contanti), 0)),
      modificatoDa: sedeFiltro ? (righe[0]?.utenteNome ?? null) : null,
      modificatoAt: sedeFiltro ? (righe[0]?.updatedAt ?? null) : null,
    };
  } catch (e: any) {
    je.ok = false; // manca la tabella (SQL da eseguire in Supabase)
    console.error("Conti: tabella conti_je non leggibile:", e?.message ?? e);
  }

  const totDomicilio = r2(totDom.totale), totAsporto = somma(asp).totale, totTavolo = somma(tav).totale;
  const totale = {
    domicilio: totDomicilio, asporto: totAsporto, tavolo: totTavolo, justEat: r2(je.giaPagato + je.contanti),
    totalone: r2(totDomicilio + totAsporto + totTavolo + je.giaPagato + je.contanti),
    contantiNoti: r2(totDom.contanti + je.contanti), // domicilio in contanti + Just Eat in contanti
    carteNote: r2(totDom.pos + je.giaPagato),        // POS del domicilio + Just Eat già pagato
    ordiniInCorso: dto.filter((o) => !["consegnato", "pronto"].includes(o.stato)).length,
  };

  // Super admin su «tutte le sedi»: una riga per sede.
  let perSede: any[] | null = null;
  if (!sedeFiltro) {
    const sedi = await prisma.sede.findMany({ where: { attiva: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
    const jePerSede = new Map<string, { g: number; c: number }>();
    try {
      const righe = await prisma.contiJe.findMany({ where: { giorno: new Date(data + "T00:00:00Z") } });
      righe.forEach((r) => jePerSede.set(r.sedeId, { g: num(r.giaPagato), c: num(r.contanti) }));
    } catch { /* tabella assente: nessuna riga Just Eat */ }
    perSede = sedi.map((s) => {
      const mie = dto.filter((o) => o.sedeId === s.id);
      const d = r2(mie.filter((o) => o.tipo === "domicilio").reduce((a, o) => a + o.totale, 0));
      const a = r2(mie.filter((o) => o.tipo === "asporto").reduce((x, o) => x + o.totale, 0));
      const t = r2(mie.filter((o) => o.tipo === "tavolo").reduce((x, o) => x + o.totale, 0));
      const j = jePerSede.get(s.id) ?? { g: 0, c: 0 };
      return { sedeId: s.id, nome: s.nome, domicilio: d, asporto: a, tavolo: t, justEatGiaPagato: r2(j.g), justEatContanti: r2(j.c), totale: r2(d + a + t + j.g + j.c) };
    });
  }

  return NextResponse.json({
    data, sedeId: sedeFiltro ?? null, consegneOk,
    domicilio: {
      totali: {
        ...totDom, totale: totDomicilio, costoConsegna: r2(totDom.costoConsegna), contanti: r2(totDom.contanti), pos: r2(totDom.pos),
        contantiDaVersare: r2(totDom.contantiDaVersare), contantiNonChiusi: r2(totDom.contantiNonChiusi), senzaMetodo: r2(totDom.senzaMetodo),
      },
      rider,
    },
    asporto: { ...somma(asp), perCanale, ordini: asp },
    tavolo: { ...somma(tav), ordini: tav },
    je, totale, perSede,
  });
}
