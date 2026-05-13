import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/clienti?q=mario&sedeId=xxx&limit=50
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const sedeId = searchParams.get("sedeId");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  const clienti = await prisma.cliente.findMany({
    where: {
      ...(q && {
        OR: [
          { nome:     { contains: q, mode: "insensitive" } },
          { cognome:  { contains: q, mode: "insensitive" } },
          { telefono: { contains: q } },
          { email:    { contains: q, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      _count: { select: { ordini: true } },
      ordini: {
        where: { ...(sedeId && { sedeId }) },
        select: { totale: true, createdAt: true, stato: true, sedeId: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Calcola totale speso per cliente
  const clientiConStats = clienti.map((c) => ({
    ...c,
    totaleSpeso: c.ordini.reduce((acc, o) => acc + parseFloat(o.totale.toString()), 0),
    ultimoOrdine: c.ordini[0]?.createdAt ?? null,
    numeroOrdini: c._count.ordini,
  }));

  return NextResponse.json(clientiConStats);
}

// POST /api/clienti — crea nuovo cliente
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const body = await req.json();
  const { nome, cognome, telefono, email, indirizzoDefault, note, sedePreferita } = body;

  if (!nome) return NextResponse.json({ error: "Nome richiesto" }, { status: 400 });

  // Evita duplicati su telefono
  if (telefono) {
    const existing = await prisma.cliente.findFirst({ where: { telefono } });
    if (existing) {
      return NextResponse.json({ error: "Cliente con questo telefono già presente", cliente: existing }, { status: 409 });
    }
  }

  const cliente = await prisma.cliente.create({
    data: { nome, cognome, telefono, email, indirizzoDefault, note, sedePreferita },
  });

  return NextResponse.json(cliente, { status: 201 });
}
