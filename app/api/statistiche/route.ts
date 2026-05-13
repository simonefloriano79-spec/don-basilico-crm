import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subDays, startOfDay, format } from "date-fns";
import { it } from "date-fns/locale";

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
  const perGiorno: Record<string, { data: string; ordini: number; incasso: number; online: number; telefono: number; walk_in: number }> = {};

  for (let i = giorni - 1; i >= 0; i--) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    const label = format(subDays(new Date(), i), "EEE d/M", { locale: it });
    perGiorno[d] = { data: label, ordini: 0, incasso: 0, online: 0, telefono: 0, walk_in: 0 };
  }

  ordini.forEach((o) => {
    const d = format(new Date(o.createdAt), "yyyy-MM-dd");
    if (!perGiorno[d]) return;
    perGiorno[d].ordini++;
    perGiorno[d].incasso += parseFloat(o.totale.toString());
    if (o.canale === "online")   perGiorno[d].online++;
    if (o.canale === "telefono") perGiorno[d].telefono++;
    if (o.canale === "walk_in")  perGiorno[d].walk_in++;
  });

  // Top prodotti nel periodo
  const topProdotti = await prisma.ordineItem.groupBy({
    by: ["nomeSnapshot"],
    where: {
      ordine: {
        createdAt: { gte: dataInizio },
        stato: { not: "annullato" },
        ...(sedeFilter && { sedeId: sedeFilter }),
      },
    },
    _sum: { quantita: true },
    orderBy: { _sum: { quantita: "desc" } },
    take: 10,
  });

  // Incasso totale periodo
  const totPeriodo = ordini.reduce((acc, o) => acc + parseFloat(o.totale.toString()), 0);
  const mediaGiornaliera = totPeriodo / giorni;

  // Canali totali
  const canaliTot = ordini.reduce(
    (acc, o) => {
      acc[o.canale] = (acc[o.canale] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return NextResponse.json({
    periodo: {
      giorni,
      dataInizio: format(dataInizio, "dd/MM/yyyy"),
      dataFine: format(new Date(), "dd/MM/yyyy"),
    },
    graficoDati: Object.values(perGiorno),
    topProdotti: topProdotti.map((p) => ({
      nome: p.nomeSnapshot,
      quantita: p._sum.quantita ?? 0,
    })),
    riepilogo: {
      totaleOrdini: ordini.length,
      incassoTotale: totPeriodo,
      mediaGiornaliera,
      canali: canaliTot,
    },
  });
}
