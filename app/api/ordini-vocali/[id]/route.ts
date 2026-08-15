import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/ordini-vocali/[id] — segna "preso in carico" o annulla dallo schermo cassa
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  const { stato } = await req.json();

  if (!["preso_in_carico", "annullato"].includes(stato)) {
    return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
  }

  const ordine = await prisma.ordineVocale.findUnique({ where: { id: params.id } });
  if (!ordine) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  if (user.ruolo !== "super_admin" && ordine.sedeId !== user.sedeId) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const aggiornato = await prisma.ordineVocale.update({
    where: { id: params.id },
    data: {
      stato,
      ...(stato === "preso_in_carico" && { presoInCaricoDa: user.id, presoInCaricoAt: new Date() }),
    },
  });

  return NextResponse.json(aggiornato);
}
