import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/utenti/[id] — solo super_admin: modifica nome, ruolo, sede, attivo
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  if (user.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const body = await req.json();
  const { nome, cognome, ruolo, sedeId, attivo } = body;

  if (attivo === false && params.id === user.id) {
    return NextResponse.json({ error: "Non puoi disattivare il tuo stesso account" }, { status: 400 });
  }

  const utente = await prisma.utente.update({
    where: { id: params.id },
    data: {
      ...(nome !== undefined && { nome }),
      ...(cognome !== undefined && { cognome }),
      ...(ruolo !== undefined && { ruolo }),
      ...(sedeId !== undefined && { sedeId: sedeId || null }),
      ...(attivo !== undefined && { attivo }),
    },
    include: { sede: { select: { nome: true } } },
  });

  const { passwordHash: _, ...utenteClean } = utente;
  return NextResponse.json(utenteClean);
}

// DELETE /api/utenti/[id] — solo super_admin (soft: disattiva)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  if (user.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  if (params.id === user.id) {
    return NextResponse.json({ error: "Non puoi disattivare il tuo stesso account" }, { status: 400 });
  }

  await prisma.utente.update({ where: { id: params.id }, data: { attivo: false } });
  return NextResponse.json({ ok: true });
}
