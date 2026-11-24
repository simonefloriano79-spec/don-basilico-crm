import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subDays, startOfDay, format } from "date-fns";
import { it } from "date-fns/locale";
import { pizzeJePerGiorno, pizzeRiga } from "@/lib/pizze-fatte";
import { leggiComboConfig } from "@/lib/combo";

// GET /api/statistiche?giorni=7&sedeId=xxx
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  const { searchParams } = new URL(req.url);
  const giorni = parseInt(searchParams.get("giorni") ?? "7");
  const sedeId = searchParams.get("sedeId");

  const sedeFilter = user.ruolo === "super_admin" ? (sedeId || undefined) : user.sedeId;

  const dataInizio = startOfDay(subDays(new Date(), giorni - 1));

  // Tutti gli ordini nel periodo
  const ordini = await prisma.ordine.findMany({
    where: {
      ...(sedeFilter && { sedeId: sedeFilter }),
      createdAt: { gte: dataInizio },
      stato: { not: "annullato" },
    },
    select: {
      createdAt: true,
      totale: true,
      canale: true,
      stato: true,
      sedeId: true,
      sede: { select: { nome: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Raggruppa per giorno
  // `incasso` = incasso totale del giorno (CRM + Just Eat); `incassoCrm` e `incassoJe` ne sono le due parti.
  const perGiorno: Record<string, { data: string; ordini: number; incasso: number; incassoCrm: number; incassoJe: number; pizze: number; pizzeCrm: number; pizzeJe: number; online: number; telefono: number; walk_in: number }> = {};

  for (let i = giorni - 1; i >= 0; i--) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    const label = format(subDays(new Date(), i), "EEE d/M", { locale: it });
    perGiorno[d] = { data: label, ordini: 0, incasso: 0, incassoCrm: 0, incassoJe: 0, pizze: 0, pizzeCrm: 0, pizzeJe: 0, online: 0, telefono: 0, walk_in: 0 };
  }

  // Pizze per giorno: quelle degli ordini del CRM (maxi = 1, combo = pizze contenute) + quelle Just Eat inserite nei Conti.
  const ordiniPizze = await prisma.ordine.findMany({
    where: { ...(sedeFilter && { sedeId: sedeFilter }), createdAt: { gte: dataInizio }, stato: { not: "annullato" } },
    select: {
      createdAt: true,
      items: { select: { quantita: true, nomeSnapshot: true, menuItem: { select: { categoria: true, comboConfig: true } }, sedeExtra: { select: { categoria: true } } } },
    },
  });
  for (const o of ordiniPizze) {
    const g = perGiorno[format(new Date(o.createdAt), "yyyy-MM-dd")];
    if (!g) continue;
    for (const i of o.items) {
      const n = pizzeRiga(i.menuItem?.categoria ?? i.sedeExtra?.categoria, i.nomeSnapshot, i.quantita, leggiComboConfig(i.menuItem?.comboConfig)?.pizze).pizze;
      g.pizzeCrm += n; g.pizze += n;
    }
  }
  (await pizzeJePerGiorno(format(dataInizio, "yyyy-MM-dd"), sedeFilter)).forEach((n, giorno) => {
    const g = perGiorno[giorno];
    if (g) { g.pizzeJe += n; g.pizze += n; }
  });

  // Incasso Just Eat inserito a mano nei Conti (già pagato + contanti), per serata e per sede. Se manca la tabella: zero.
  const jePerSede: Record<string, number> = {};
  let jeTotale = 0;
  try {
    const righeJe = await prisma.contiJe.findMany({
      where: { giorno: { gte: new Date(format(dataInizio, "yyyy-MM-dd") + "T00:00:00Z") }, ...(sedeFilter && { sedeId: sedeFilter }) },
      select: { sedeId: true, giorno: true, giaPagato: true, contanti: true },
    });
    const sedi = await prisma.sede.findMany({ select: { id: true, nome: true } });
    const nomeSede = new Map(sedi.map((s) => [s.id, s.nome.replace("Don Basilico ", "")]));
    for (const r of righeJe) {
      const importo = parseFloat(r.giaPagato.toString()) + parseFloat(r.contanti.toString());
      const d = r.giorno.toISOString().slice(0, 10);
      if (!perGiorno[d] || !importo) continue;
      perGiorno[d].incassoJe += importo;
      perGiorno[d].incasso += importo;
      jeTotale += importo;
      const nome = nomeSede.get(r.sedeId) ?? "—";
      jePerSede[nome] = (jePerSede[nome] ?? 0) + importo;
    }
  } catch (e: any) {
    console.error("Statistiche: Just Eat non leggibile:", e?.message ?? e);
  }

  ordini.forEach((o) => {
    const d = format(new Date(o.createdAt), "yyyy-MM-dd");
    if (!perGiorno[d]) return;
    perGiorno[d].ordini++;
    perGiorno[d].incasso += parseFloat(o.totale.toString());
    perGiorno[d].incassoCrm += parseFloat(o.totale.toString());
    if (o.canale === "online")   perGiorno[d].online++;
    if (o.canale === "telefono") perGiorno[d].telefono++;
    if (o.canale === "walk_in")  perGiorno[d].walk_in++;
  });

  // Top prodotti nel periodo
  // Per prodotto: pezzi venduti e importo (prezzo della riga × quantità, senza consegna né sconti sull'ordine).
  const righe = await prisma.ordineItem.findMany({
    where: {
      ordine: {
        createdAt: { gte: dataInizio },
        stato: { not: "annullato" },
        ...(sedeFilter && { sedeId: sedeFilter }),
      },
    },
    select: { nomeSnapshot: true, quantita: true, prezzoSnapshot: true },
  });
  const perProdotto = new Map<string, { nome: string; quantita: number; importo: number }>();
  for (const r of righe) {
    const p = perProdotto.get(r.nomeSnapshot) ?? { nome: r.nomeSnapshot, quantita: 0, importo: 0 };
    p.quantita += r.quantita;
    p.importo += parseFloat(r.prezzoSnapshot.toString()) * r.quantita;
    perProdotto.set(r.nomeSnapshot, p);
  }
  const prodotti = Array.from(perProdotto.values());
  const topProdotti = [...prodotti].sort((a, b) => b.quantita - a.quantita).slice(0, 10);
  const topProdottiValore = [...prodotti]
    .map((p) => ({ ...p, importo: Math.round(p.importo * 100) / 100 }))
    .sort((a, b) => b.importo - a.importo)
    .slice(0, 10);

  // Incasso totale periodo
  const totCrm = ordini.reduce((acc, o) => acc + parseFloat(o.totale.toString()), 0);
  const totPeriodo = totCrm + jeTotale;
  const mediaGiornaliera = totPeriodo / giorni;

  // Canali totali
  const canaliTot = ordini.reduce(
    (acc, o) => {
      acc[o.canale] = (acc[o.canale] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Incasso per sede (rilevante solo quando si guardano tutte le sedi)
  const incassoPerSedeMap: Record<string, number> = {};
  ordini.forEach((o) => {
    const nome = o.sede?.nome?.replace("Don Basilico ", "") ?? "—";
    incassoPerSedeMap[nome] = (incassoPerSedeMap[nome] ?? 0) + parseFloat(o.totale.toString());
  });
  Object.entries(jePerSede).forEach(([nome, importo]) => { incassoPerSedeMap[nome] = (incassoPerSedeMap[nome] ?? 0) + importo; });
  const incassoPerSede = Object.entries(incassoPerSedeMap)
    .map(([nome, incasso]) => ({ nome, incasso }))
    .sort((a, b) => b.incasso - a.incasso);

  return NextResponse.json({
    periodo: {
      giorni,
      dataInizio: format(dataInizio, "dd/MM/yyyy"),
      dataFine: format(new Date(), "dd/MM/yyyy"),
    },
    graficoDati: Object.values(perGiorno),
    topProdotti: topProdotti.map((p) => ({ nome: p.nome, quantita: p.quantita })),
    topProdottiValore: topProdottiValore.map((p) => ({ nome: p.nome, quantita: p.quantita, importo: p.importo })),
    incassoPerSede,
    riepilogo: {
      totaleOrdini: ordini.length,
      incassoTotale: totPeriodo,
      incassoCrm: totCrm,
      incassoJustEat: jeTotale,
      mediaGiornaliera,
      canali: canaliTot,
    },
  });
}
