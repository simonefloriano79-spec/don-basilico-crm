import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { finestraServizio, giornoServizioOggi } from "@/lib/conti";
import { pizzeJePerSede, pizzePerSede } from "@/lib/pizze-fatte";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  const isSuperAdmin = user.ruolo === "super_admin";
  const sedeFilter = isSuperAdmin ? undefined : user.sedeId;

  // «Oggi» = la serata in corso, dalle 5:00 alle 5:00 (come Conti ed esauriti): gli ordini presi dopo mezzanotte
  // contano ancora per la serata di ieri e tutti i numeri della Panoramica si azzerano insieme alle 5:00.
  const giornoServizio = giornoServizioOggi();
  const { inizio: inizioServizio, fine: fineServizio } = finestraServizio(giornoServizio);
  const oggi = inizioServizio;

  const [ordiniOggi, ordiniAttivi, pronti, online, sedi] = await Promise.all([
    prisma.ordine.findMany({
      where: { ...(sedeFilter && { sedeId: sedeFilter }), createdAt: { gte: oggi }, stato: { not: "annullato" } },
      select: { totale: true, canale: true, stato: true, sedeId: true },
    }),
    prisma.ordine.count({
      where: { ...(sedeFilter && { sedeId: sedeFilter }), stato: { notIn: ["consegnato", "annullato"] } },
    }),
    prisma.ordine.count({
      where: { ...(sedeFilter && { sedeId: sedeFilter }), stato: "pronto" },
    }),
    prisma.ordine.count({
      where: { ...(sedeFilter && { sedeId: sedeFilter }), canale: "online", createdAt: { gte: oggi } },
    }),
    prisma.sede.findMany({
      where: { attiva: true, ...(sedeFilter && { id: sedeFilter }) },
      include: {
        ordini: {
          where: { createdAt: { gte: oggi }, stato: { not: "annullato" } },
          select: { totale: true, canale: true, stato: true },
        },
      },
      orderBy: { nome: "asc" },
    }),
  ]);

  // Pizze della serata (dalle 5:00 alle 5:00, come i Conti): nostre + Just Eat inserite a mano. Mai bloccanti per il resto.
  const pizzeNostre = await pizzePerSede(inizioServizio, fineServizio, sedeFilter).catch(() => new Map<string, { pizze: number; maxi: number }>());
  const pizzeJe = (await pizzeJePerSede(giornoServizio, sedeFilter)).per;
  let pizzeTotNostre = 0, pizzeTotJe = 0;

  const incassoOggi = ordiniOggi.reduce((acc, o) => acc + parseFloat(o.totale.toString()), 0);

  const sediStats = sedi.map((s) => {
    const ord = s.ordini;
    const pn = pizzeNostre.get(s.id)?.pizze ?? 0, pj = pizzeJe.get(s.id) ?? 0;
    pizzeTotNostre += pn; pizzeTotJe += pj;
    return {
      pizzeNostre: pn, pizzeJustEat: pj, pizzeTotali: pn + pj,
      id: s.id,
      nome: s.nome.replace("Don Basilico ", ""),
      nomeCompleto: s.nome,
      slug: s.slug,
      ordiniAttivi: ord.filter((o) => !["consegnato", "annullato"].includes(o.stato)).length,
      pronti: ord.filter((o) => o.stato === "pronto").length,
      incassoOggi: ord.reduce((acc, o) => acc + parseFloat(o.totale.toString()), 0),
      totaleOrdiniOggi: ord.length,
      canali: {
        online: ord.filter((o) => o.canale === "online").length,
        telefono: ord.filter((o) => o.canale === "telefono").length,
        walk_in: ord.filter((o) => o.canale === "walk_in").length,
      },
    };
  });

  return NextResponse.json({
    ordiniAttivi,
    incassoOggi,
    pronti,
    online,
    sediStats,
    totali: {
      pizzeNostre: pizzeTotNostre, pizzeJustEat: pizzeTotJe, pizzeTotali: pizzeTotNostre + pizzeTotJe,
      ordiniOggi: ordiniOggi.length,
      incasso: incassoOggi,
      online: ordiniOggi.filter((o) => o.canale === "online").length,
      telefono: ordiniOggi.filter((o) => o.canale === "telefono").length,
      walk_in: ordiniOggi.filter((o) => o.canale === "walk_in").length,
    },
  });
}
