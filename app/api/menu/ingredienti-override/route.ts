import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/menu/ingredienti-override
// Abilita/disabilita un ingrediente in una sede
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  const { sedeId, ingredienteId, disabilita, note } = await req.json();

  // Verifica permesso sede
  if (user.ruolo !== "super_admin" && user.sedeId !== sedeId) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  // «Finito» in questa sede: vale fino alle 5:00 del giorno dopo (vedi lib/esauriti.ts). Si ricrea il segno a ogni richiesta.
  await prisma.sedeIngredienteDisabilitato.deleteMany({ where: { sedeId, ingredienteId } });
  if (disabilita) {
    const record = await prisma.sedeIngredienteDisabilitato.create({
      data: { sedeId, ingredienteId, note, disabilitatoDa: user.id },
    });
    return NextResponse.json(record);
  }
  return NextResponse.json({ ok: true });
}
