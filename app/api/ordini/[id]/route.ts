import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/ordini/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;

  const ordine = await prisma.ordine.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: {
          menuItem: { select: { nome: true, categoria: true } },
          sedeExtra: { select: { nome: true, categoria: true } },
        },
      },
      sede: true,
      cliente: true,
      statiLog: {
        include: { utente: { select: { nome: true, cognome: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ordine) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  if (user.ruolo !== "super_admin" && ordine.sedeId !== user.sedeId) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  return NextResponse.json(ordine);
}

// PATCH /api/ordini/[id] - aggiorna stato o stampato
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const body = await req.json();
  const user = session.user as any;
  const { stato, stampato, note } = body;

  const STATI_FLOW = ["nuovo", "confermato", "in_preparazione", "pronto", "consegnato", "annullato"];

  const ordineAttuale = await prisma.ordine.findUnique({ where: { id: params.id } });
  if (!ordineAttuale) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  if (user.ruolo !== "super_admin" && ordineAttuale.sedeId !== user.sedeId) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  // Validazione avanzamento stato
  if (stato) {
    const idx = STATI_FLOW.indexOf(ordineAttuale.stato);
    const newIdx = STATI_FLOW.indexOf(stato);
    if (newIdx < 0) return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
  }

  const ordineAggiornato = await prisma.ordine.update({
    where: { id: params.id },
    data: {
      ...(stato && { stato }),
      ...(stampato !== undefined && { stampato }),
      ...(stato === "pronto" && { oraEffettivaPronte: new Date() }),
    },
    include: { items: true, sede: { select: { nome: true } } },
  });

  // Log cambio stato
  if (stato) {
    await prisma.ordineStatoLog.create({
      data: {
        ordineId: params.id,
        stato,
        utenteId: user.id,
        note,
      },
    });
  }

  return NextResponse.json(ordineAggiornato);
}
