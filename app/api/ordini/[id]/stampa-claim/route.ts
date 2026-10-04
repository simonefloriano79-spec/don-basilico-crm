import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/ordini/[id]/stampa-claim — "prenota" la stampa di un ordine: segna stampato=true solo se era ancora
// false (aggiornamento atomico). Chi riceve claimed:true stampa, chiunque altro no: con più schermate aperte
// la comanda esce una volta sola.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;

  const ordine = await prisma.ordine.findUnique({ where: { id: params.id }, select: { sedeId: true } });
  if (!ordine) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  if (user.ruolo !== "super_admin" && ordine.sedeId !== user.sedeId) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const r = await prisma.ordine.updateMany({ where: { id: params.id, stampato: false }, data: { stampato: true } });
  return NextResponse.json({ claimed: r.count === 1 });
}
