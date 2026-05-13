import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/ingredienti/[id]
// Admin: modifica prezzo_aggiunta, nome, is_allergene
// Operatore sede: disabilita/riabilita nella propria sede
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  const body = await req.json();

  if (user.ruolo === "super_admin") {
    // Admin: modifica globale
    const { nome, prezzoAggiunta, isAllergene, disponibileDefault } = body;

    const updated = await prisma.ingrediente.update({
      where: { id: params.id },
      data: {
        ...(nome !== undefined && { nome }),
        ...(prezzoAggiunta !== undefined && { prezzoAggiunta }),
        ...(isAllergene !== undefined && { isAllergene }),
        ...(disponibileDefault !== undefined && { disponibileDefault }),
      },
    });

    return NextResponse.json(updated);
  }

  // Operatore sede: toggle disabilitazione locale
  const { sedeId, disabilita, note } = body;

  if (!sedeId) {
    return NextResponse.json({ error: "sedeId richiesto" }, { status: 400 });
  }

  if (user.sedeId !== sedeId) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  if (disabilita) {
    const record = await prisma.sedeIngredienteDisabilitato.upsert({
      where: {
        sedeId_ingredienteId: { sedeId, ingredienteId: params.id },
      },
      update: { note, disabilitatoDa: user.id },
      create: {
        sedeId,
        ingredienteId: params.id,
        note,
        disabilitatoDa: user.id,
      },
    });
    return NextResponse.json(record);
  } else {
    await prisma.sedeIngredienteDisabilitato.deleteMany({
      where: { sedeId, ingredienteId: params.id },
    });
    return NextResponse.json({ ok: true });
  }
}

// DELETE /api/ingredienti/[id] — solo admin (soft: disattiva)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  if (user.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  await prisma.ingrediente.update({
    where: { id: params.id },
    data: { disponibileDefault: false },
  });

  return NextResponse.json({ ok: true });
}
