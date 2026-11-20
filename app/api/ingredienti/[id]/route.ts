import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ALLERGENI } from "@/lib/allergeni";

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
    const { nome, prezzoAggiunta, isAllergene, disponibileDefault, escludiCompensazione, allergeni, allergeniDaVerificare } = body;
    const codiciValidi = new Set(ALLERGENI.map((a) => a.codice));
    const allergeniPuliti: string[] | undefined = Array.isArray(allergeni)
      ? Array.from(new Set(allergeni.filter((x: unknown): x is string => typeof x === "string" && codiciValidi.has(x))))
      : undefined;

    const updated = await prisma.ingrediente.update({
      where: { id: params.id },
      data: {
        ...(nome !== undefined && { nome }),
        ...(prezzoAggiunta !== undefined && { prezzoAggiunta }),
        ...(isAllergene !== undefined && { isAllergene }),
        ...(allergeniPuliti !== undefined && { allergeni: allergeniPuliti, isAllergene: allergeniPuliti.length > 0 }),
        ...(allergeniDaVerificare !== undefined && { allergeniDaVerificare: !!allergeniDaVerificare }),
        ...(disponibileDefault !== undefined && { disponibileDefault }),
        ...(escludiCompensazione !== undefined && { escludiCompensazione }),
      },
    });

    // Cascata: un ingrediente disattivato globalmente (non più in gamma)
    // disattiva anche i prodotti che lo usano come ingrediente base — e
    // viceversa alla riattivazione. Es. disattivi le Alici -> la Napoletana
    // (che le contiene) si disattiva automaticamente.
    if (disponibileDefault !== undefined) {
      const collegati = await prisma.menuItemIngrediente.findMany({
        where: { ingredienteId: params.id },
        select: { menuItemId: true },
      });
      if (collegati.length) {
        await prisma.menuItem.updateMany({
          where: { id: { in: collegati.map((c) => c.menuItemId) } },
          data: { isAttivo: disponibileDefault },
        });
      }
    }

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

  // «Finito» in questa sede (es. il prosciutto cotto): vale fino alle 5:00 del giorno dopo e poi decade da solo.
  // Le pizze che lo contengono seguono da sole (calcolato in lettura, vedi lib/esauriti.ts): qui non si scrive sulle pizze,
  // così alle 5:00 tornano disponibili tutte insieme e una pizza «Disattivata» apposta non viene toccata.
  await prisma.sedeIngredienteDisabilitato.deleteMany({ where: { sedeId, ingredienteId: params.id } });

  if (disabilita) {
    // Si ricrea sempre il segno (createdAt = adesso): segnarlo di nuovo prolunga fino alle 5:00 di domani.
    const record = await prisma.sedeIngredienteDisabilitato.create({
      data: { sedeId, ingredienteId: params.id, note, disabilitatoDa: user.id },
    });
    return NextResponse.json(record);
  }
  return NextResponse.json({ ok: true });
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
