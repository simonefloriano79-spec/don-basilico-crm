import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  const { searchParams } = new URL(req.url);
  const sedeId = searchParams.get("sedeId");

  const sedeFilter = user.ruolo === "super_admin" ? (sedeId || undefined) : user.sedeId;

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  const [ordiniOggi, ordiniAttivi, pronti, online, sediStats] = await Promise.all([
    // Ordini di oggi
    prisma.ordine.findMany({
      where: {
        ...(sedeFilter && { sedeId: sedeFilter }),
        createdAt: { gte: oggi },
      },
      select: { totale: true, canale: true, stato: true, sedeId: true },
    }),

    // Ordini attivi (non chiusi)
    prisma.ordine.count({
      where: {
        ...(sedeFilter && { sedeId: sedeFilter }),
        stato: { notIn: ["consegnato", "annullato"] },
      },
    }),

    // Pronti da ritirare
    prisma.ordine.count({
      where: {
        ...(sedeFilter && { sedeId: sedeFilter }),
        stato: "pronto",
      },
    }),

    // Online oggi
    prisma.ordine.count({
      where: {
        ...(sedeFilter && { sedeId: sedeFilter }),
        canale: "online",
        createdAt: { gte: oggi },
      },
    }),

    // Stats per sede
    prisma.sede.findMany({
      where: { attiva: true },
      include: {
        _count: {
          select: {
            ordini: {
              where: { stato: { notIn: ["consegnato", "annullato"] } },
            },
          },
        },
      },
    }),
  ]);

  const incassoOggi = ordiniOggi.reduce((acc, o) => acc + parseFloat(o.totale.toString()), 0);

  return NextResponse.json({
    ordiniAttivi,
    incassoOggi,
    pronti,
    online,
    sediStats: sediStats.map((s) => ({
      id: s.id,
      nome: s.nome,
      ordiniAttivi: s._count.ordini,
    })),
  });
}
