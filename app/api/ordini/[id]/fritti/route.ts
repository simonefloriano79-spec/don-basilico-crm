import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { frittiDellOrdine, idComponentiCombo } from "@/lib/fritti";

// GET /api/ordini/:id/fritti — righe per il foglietto della friggitoria (lo chiede la stampa della comanda).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;

  const ordine = await prisma.ordine.findUnique({
    where: { id: params.id },
    select: {
      sedeId: true,
      items: {
        select: { nomeSnapshot: true, quantita: true, noteItem: true, menuItem: { select: { categoria: true, comboConfig: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!ordine) return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 });
  if (user.ruolo !== "super_admin" && ordine.sedeId !== user.sedeId) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const idCombo = idComponentiCombo(ordine.items);
  const componenti = idCombo.length
    ? await prisma.menuItem.findMany({ where: { id: { in: idCombo }, categoria: "fritti" }, select: { id: true, nome: true } })
    : [];

  return NextResponse.json(frittiDellOrdine(ordine.items, new Map(componenti.map((c) => [c.id, c.nome]))));
}
