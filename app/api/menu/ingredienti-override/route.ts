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

  if (disabilita) {
    // Disabilita ingrediente
    const record = await prisma.sedeIngredienteDisabilitato.upsert({
      where: { sedeId_ingredienteId: { sedeId, ingredienteId } },
      update: { note, disabilitatoDa: user.id },
      create: { sedeId, ingredienteId, note, disabilitatoDa: user.id },
    });
    return NextResponse.json(record);
  } else {
    // Riabilita ingrediente
    await prisma.sedeIngredienteDisabilitato.deleteMany({
      where: { sedeId, ingredienteId },
    });
    return NextResponse.json({ ok: true });
  }
}
