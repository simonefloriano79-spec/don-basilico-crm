import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/ordini/da-stampare?sedeId= — ordini della sede mai stampati (es. presi da telefono/tablet o accettati
// dal sito online), per la stampa automatica del PC della cassa. Solo ordini attivi delle ultime 24 ore; gli
// ordini online non ancora accettati non si stampano.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;

  const sedeId = user.ruolo === "super_admin" ? req.nextUrl.searchParams.get("sedeId") : user.sedeId;
  if (!sedeId) return NextResponse.json([]);

  const ordini = await prisma.ordine.findMany({
    where: {
      sedeId,
      stampato: false,
      stato: { in: ["nuovo", "confermato", "in_preparazione"] },
      createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
      NOT: { canale: "online", stato: "nuovo" },
    },
    include: { items: true, sede: { select: { nome: true } } },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  return NextResponse.json(ordini);
}
