import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/menu/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  const body = await req.json();

  // Super admin: modifica globale
  if (user.ruolo === "super_admin") {
    const { nome, descrizione, categoria, prezzoBase, isAttivo, immagineUrl, ordineVisualizzazione } = body;
    const item = await prisma.menuItem.update({
      where: { id: params.id },
      data: {
        ...(nome !== undefined && { nome }),
        ...(descrizione !== undefined && { descrizione }),
        ...(categoria !== undefined && { categoria }),
        ...(prezzoBase !== undefined && { prezzoBase }),
        ...(isAttivo !== undefined && { isAttivo }),
        ...(immagineUrl !== undefined && { immagineUrl }),
        ...(ordineVisualizzazione !== undefined && { ordineVisualizzazione }),
      },
    });
    return NextResponse.json(item);
  }

  // Operatore sede: solo override
  const { disponibile, prezzoCustom, sedeId, noteSede } = body;

  if (!sedeId) {
    return NextResponse.json({ error: "sedeId richiesto" }, { status: 400 });
  }

  // Verifica che l'operatore appartenga alla sede
  if (user.sedeId !== sedeId) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const override = await prisma.sedeMenuOverride.upsert({
    where: { sedeId_menuItemId: { sedeId, menuItemId: params.id } },
    update: {
      ...(disponibile !== undefined && { disponibile }),
      ...(prezzoCustom !== undefined && { prezzoCustom }),
      ...(noteSede !== undefined && { noteSede }),
    },
    create: {
      sedeId,
      menuItemId: params.id,
      disponibile: disponibile ?? true,
      prezzoCustom: prezzoCustom ?? null,
      noteSede: noteSede ?? null,
    },
  });

  return NextResponse.json(override);
}

// DELETE /api/menu/[id] - solo super_admin (soft delete)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  if (user.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  await prisma.menuItem.update({
    where: { id: params.id },
    data: { isAttivo: false },
  });

  return NextResponse.json({ ok: true });
}
