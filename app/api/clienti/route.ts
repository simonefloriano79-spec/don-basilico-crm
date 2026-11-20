import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filtroClientiVisibili, telefoniEsatti } from "@/lib/clienti-visibilita";

// GET /api/clienti?q=mario&sedeId=xxx&limit=50
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  const isSuperAdmin = user.ruolo === "super_admin";
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  // Gli account delle sedi vedono solo i clienti che hanno ordinato nella propria sede (vedi lib/clienti-visibilita.ts):
  // ordini e totali si contano sempre e solo sulla propria sede.
  const sedeId = isSuperAdmin ? searchParams.get("sedeId") : (user.sedeId as string | null);
  if (!isSuperAdmin && !sedeId) return NextResponse.json([]);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50") || 50, 1), 200);

  const clienti = await prisma.cliente.findMany({
    where: {
      AND: [
        filtroClientiVisibili(user, q),
        q
          ? {
              OR: [
                { nome:             { contains: q, mode: "insensitive" } },
                { cognome:          { contains: q, mode: "insensitive" } },
                { telefono:         { contains: q } },
                // Numero scritto con spazi, trattini o +39: si cerca anche nelle forme in cui può essere salvato.
                ...(telefoniEsatti(q).length ? [{ telefono: { in: telefoniEsatti(q) } }] : []),
                { email:            { contains: q, mode: "insensitive" } },
                { indirizzoDefault: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    include: {
      _count: { select: { ordini: isSuperAdmin ? true : { where: { sedeId: sedeId as string } } } },
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
