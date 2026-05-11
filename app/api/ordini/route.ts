import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/ordini
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sedeId = searchParams.get("sedeId");
  const stato = searchParams.get("stato");
  const canale = searchParams.get("canale");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  const user = session.user as any;
  // Operatori vedono solo la propria sede
  const sedeFilter = user.ruolo === "super_admin" ? sedeId : user.sedeId;

  const ordini = await prisma.ordine.findMany({
    where: {
      ...(sedeFilter && { sedeId: sedeFilter }),
      ...(stato && { stato: stato as any }),
      ...(canale && { canale: canale as any }),
    },
    include: {
      items: true,
      sede: { select: { nome: true, slug: true } },
      cliente: { select: { nome: true, telefono: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(ordini);
}

// POST /api/ordini
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const body = await req.json();
  const user = session.user as any;

  const {
    sedeId,
    canale,
    tipo,
    clienteNome,
    clienteTelefono,
    clienteIndirizzo,
    clienteId,
    note,
    items, // Array<{ menuItemId?, sedeExtraId?, nomeSnapshot, prezzoSnapshot, quantita, noteItem?, ingredientiRimossi? }>
  } = body;

  if (!sedeId || !canale || !tipo || !items?.length) {
    return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
  }

  // Calcola totale
  const totale = items.reduce(
    (acc: number, i: any) => acc + parseFloat(i.prezzoSnapshot) * i.quantita,
    0
  );

  const ordine = await prisma.ordine.create({
    data: {
      sedeId,
      canale,
      tipo,
      stato: "nuovo",
      clienteId: clienteId || null,
      operatoreId: canale !== "online" ? user.id : null,
      clienteNome,
      clienteTelefono,
      clienteIndirizzo,
      note,
      totale,
      items: {
        create: items.map((i: any) => ({
          menuItemId: i.menuItemId || null,
          sedeExtraId: i.sedeExtraId || null,
          nomeSnapshot: i.nomeSnapshot,
          prezzoSnapshot: i.prezzoSnapshot,
          quantita: i.quantita,
          noteItem: i.noteItem || null,
          ingredientiRimossi: i.ingredientiRimossi || [],
        })),
      },
    },
    include: {
      items: true,
      sede: { select: { nome: true } },
    },
  });

  // Log stato iniziale
  await prisma.ordineStatoLog.create({
    data: {
      ordineId: ordine.id,
      stato: "nuovo",
      utenteId: user.id,
    },
  });

  return NextResponse.json(ordine, { status: 201 });
}
