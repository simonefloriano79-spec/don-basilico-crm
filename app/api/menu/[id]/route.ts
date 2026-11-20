import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Disponibilità di un prodotto in una sede: due interruttori separati (vedi lib/esauriti.ts).
//  - `disponibile`: «in vendita» (permanente). Cambiarlo toglie anche un eventuale «esaurito».
//  - `esaurito`: «Esaurito» fino alle 5:00 del giorno dopo (true) oppure tolto subito (false).
function datiDisponibilita(disponibile: unknown, esaurito: unknown) {
  const d: { disponibile?: boolean; esauritoIl?: Date | null } = {};
  if (typeof disponibile === "boolean") { d.disponibile = disponibile; d.esauritoIl = null; }
  if (typeof esaurito === "boolean") d.esauritoIl = esaurito ? new Date() : null;
  return d;
}

// PATCH /api/menu/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  const body = await req.json();

  // Super admin: modifica globale, oppure override su una sede a sua scelta
  if (user.ruolo === "super_admin") {
    const { sedeId: sedeIdAdmin, disponibile: disponibileAdmin, esaurito: esauritoAdmin, prezzoCustom: prezzoCustomAdmin, noteSede: noteSedeAdmin } = body;
    if (sedeIdAdmin) {
      const disp = datiDisponibilita(disponibileAdmin, esauritoAdmin);
      const override = await prisma.sedeMenuOverride.upsert({
        where: { sedeId_menuItemId: { sedeId: sedeIdAdmin, menuItemId: params.id } },
        update: {
          ...disp,
          ...(prezzoCustomAdmin !== undefined && { prezzoCustom: prezzoCustomAdmin }),
          ...(noteSedeAdmin !== undefined && { noteSede: noteSedeAdmin }),
        },
        create: {
          sedeId: sedeIdAdmin,
          menuItemId: params.id,
          disponibile: disp.disponibile ?? true,
          esauritoIl: disp.esauritoIl ?? null,
          prezzoCustom: prezzoCustomAdmin ?? null,
          noteSede: noteSedeAdmin ?? null,
        },
      });
      return NextResponse.json(override);
    }

    const { nome, descrizione, categoria, prezzoBase, prezzoOnline, isAttivo, immagineUrl, ordineVisualizzazione } = body;
    const item = await prisma.menuItem.update({
      where: { id: params.id },
      data: {
        ...(nome !== undefined && { nome }),
        ...(descrizione !== undefined && { descrizione }),
        ...(categoria !== undefined && { categoria }),
        ...(prezzoBase !== undefined && { prezzoBase }),
        ...(prezzoOnline !== undefined && { prezzoOnline }),
        ...(isAttivo !== undefined && { isAttivo }),
        ...(immagineUrl !== undefined && { immagineUrl }),
        ...(ordineVisualizzazione !== undefined && { ordineVisualizzazione }),
      },
    });
    return NextResponse.json(item);
  }

  // Operatore sede: solo override della propria sede
  const { disponibile, esaurito, prezzoCustom, sedeId, noteSede } = body;

  if (!sedeId) {
    return NextResponse.json({ error: "sedeId richiesto" }, { status: 400 });
  }

  // Verifica che l'operatore appartenga alla sede
  if (user.sedeId !== sedeId) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const disp = datiDisponibilita(disponibile, esaurito);
  const override = await prisma.sedeMenuOverride.upsert({
    where: { sedeId_menuItemId: { sedeId, menuItemId: params.id } },
    update: {
      ...disp,
      ...(prezzoCustom !== undefined && { prezzoCustom }),
      ...(noteSede !== undefined && { noteSede }),
    },
    create: {
      sedeId,
      menuItemId: params.id,
      disponibile: disp.disponibile ?? true,
      esauritoIl: disp.esauritoIl ?? null,
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
