import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leggiProdotto, type DatiProdotto } from "@/lib/menu-prodotto";

// Disponibilità di un prodotto in una sede: due interruttori separati (vedi lib/esauriti.ts).
//  - `disponibile`: «in vendita» (permanente). Cambiarlo toglie anche un eventuale «esaurito».
//  - `esaurito`: «Esaurito» fino alle 5:00 del giorno dopo (true) oppure tolto subito (false).
function datiDisponibilita(disponibile: unknown, esaurito: unknown) {
  const d: { disponibile?: boolean; esauritoIl?: Date | null } = {};
  if (typeof disponibile === "boolean") { d.disponibile = disponibile; d.esauritoIl = null; }
  if (typeof esaurito === "boolean") d.esauritoIl = esaurito ? new Date() : null;
  return d;
}

// Dati del modulo «Modifica»: campi del prodotto e, se mandati, ingredienti (sostituiscono quelli di prima).
async function salvaProdotto(id: string, dati: DatiProdotto, altri: { isAttivo?: boolean; immagineUrl?: string; ordineVisualizzazione?: number }) {
  const { ingredientiIds, ...campi } = dati;
  return prisma.menuItem.update({
    where: { id },
    data: {
      ...(campi as any),
      ...altri,
      ...(ingredientiIds && { ingredienti: { deleteMany: {}, create: ingredientiIds.map((ingredienteId) => ({ ingredienteId })) } }),
    },
  });
}

// PATCH /api/menu/[id]
//  - con `sedeId` e `disponibile`/`esaurito`: interruttori di vendita di quella sede;
//  - altrimenti: modifica del prodotto. Quelli comuni li cambia solo il super admin; una sede cambia solo i suoi.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  const isSuperAdmin = user.ruolo === "super_admin";
  const body = await req.json();

  const item = await prisma.menuItem.findUnique({ where: { id: params.id }, select: { id: true, sedeId: true } });
  if (!item) return NextResponse.json({ error: "Prodotto non trovato" }, { status: 404 });
  // I prodotti di un'altra sede non esistono per chi non è super admin.
  if (!isSuperAdmin && item.sedeId && item.sedeId !== user.sedeId) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const { sedeId, disponibile, esaurito, prezzoCustom, noteSede } = body;
  if (sedeId) {
    if (!isSuperAdmin && user.sedeId !== sedeId) return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
    if (item.sedeId && item.sedeId !== sedeId) return NextResponse.json({ error: "Questo prodotto è di un'altra sede" }, { status: 400 });
    const disp = datiDisponibilita(disponibile, esaurito);
    // Il prezzo di un prodotto comune lo decide solo il super admin.
    const prezzoSede = isSuperAdmin && prezzoCustom !== undefined ? { prezzoCustom } : {};
    const override = await prisma.sedeMenuOverride.upsert({
      where: { sedeId_menuItemId: { sedeId, menuItemId: params.id } },
      update: { ...disp, ...prezzoSede, ...(noteSede !== undefined && { noteSede }) },
      create: {
        sedeId,
        menuItemId: params.id,
        disponibile: disp.disponibile ?? true,
        esauritoIl: disp.esauritoIl ?? null,
        prezzoCustom: (isSuperAdmin ? prezzoCustom : null) ?? null,
        noteSede: noteSede ?? null,
      },
    });
    return NextResponse.json(override);
  }

  if (!isSuperAdmin && !item.sedeId) {
    return NextResponse.json({ error: "I prodotti comuni li modifica solo l'amministratore: crea la tua versione" }, { status: 403 });
  }

  const dati = leggiProdotto(body, { nuovo: false, isSuperAdmin });
  if ("errore" in dati) return NextResponse.json({ error: dati.errore }, { status: 400 });
  const { isAttivo, immagineUrl, ordineVisualizzazione } = body;
  const aggiornato = await salvaProdotto(params.id, dati, {
    ...(typeof isAttivo === "boolean" && { isAttivo }),
    ...(isSuperAdmin && immagineUrl !== undefined && { immagineUrl }),
    ...(isSuperAdmin && ordineVisualizzazione !== undefined && { ordineVisualizzazione }),
  });
  return NextResponse.json(aggiornato);
}

// DELETE /api/menu/[id] — il super admin per qualsiasi prodotto, una sede solo per i propri (si disattiva, non si cancella:
// resta negli ordini già fatti).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  const item = await prisma.menuItem.findUnique({ where: { id: params.id }, select: { sedeId: true } });
  if (!item) return NextResponse.json({ error: "Prodotto non trovato" }, { status: 404 });
  if (user.ruolo !== "super_admin" && (!item.sedeId || item.sedeId !== user.sedeId)) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  await prisma.menuItem.update({
    where: { id: params.id },
    data: { isAttivo: false },
  });

  return NextResponse.json({ ok: true });
}
