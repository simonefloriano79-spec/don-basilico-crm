import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/clienti/[id] — dettaglio cliente con storico ordini completo
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const cliente = await prisma.cliente.findUnique({
    where: { id: params.id },
    include: {
      ordini: {
        include: {
          sede: { select: { nome: true } },
          items: { select: { nomeSnapshot: true, quantita: true, prezzoSnapshot: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });

  if (!cliente) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  const totaleSpeso = cliente.ordini.reduce(
    (acc, o) => acc + parseFloat(o.totale.toString()), 0
  );

  return NextResponse.json({ ...cliente, totaleSpeso });
}

// PATCH /api/clienti/[id] — aggiorna cliente
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const body = await req.json();
  const { nome, cognome, telefono, email, indirizzoDefault, note, sedePreferita } = body;

  const cliente = await prisma.cliente.update({
    where: { id: params.id },
    data: {
      ...(nome             !== undefined && { nome }),
      ...(cognome          !== undefined && { cognome }),
      ...(telefono         !== undefined && { telefono }),
      ...(email            !== undefined && { email }),
      ...(indirizzoDefault !== undefined && { indirizzoDefault }),
      ...(note             !== undefined && { note }),
      ...(sedePreferita    !== undefined && { sedePreferita }),
    },
  });

  return NextResponse.json(cliente);
}
