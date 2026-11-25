import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Il super admin gestisce tutti i clienti; gli account delle sedi solo quelli che hanno già ordinato nella propria sede.
async function puoGestireCliente(user: { ruolo?: string; sedeId?: string | null }, clienteId: string) {
  if (user.ruolo === "super_admin") return true;
  if (!user.sedeId) return false;
  if (await prisma.cliente.findFirst({ where: { id: clienteId, sedePreferita: user.sedeId }, select: { id: true } })) return true;
  return !!(await prisma.ordine.findFirst({ where: { clienteId, sedeId: user.sedeId }, select: { id: true } }));
}

// GET /api/clienti/[id] — dettaglio cliente con storico ordini completo
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  const sedeMia = user.ruolo === "super_admin" ? null : (user.sedeId as string | null);
  if (!(await puoGestireCliente(user, params.id))) return NextResponse.json({ error: "Permesso negato" }, { status: 403 });

  const cliente = await prisma.cliente.findUnique({
    where: { id: params.id },
    include: {
      ordini: {
        // Gli account delle sedi vedono solo lo storico della propria sede.
        where: sedeMia ? { sedeId: sedeMia } : undefined,
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

  const user = session.user as any;
  if (!(await puoGestireCliente(user, params.id))) return NextResponse.json({ error: "Permesso negato" }, { status: 403 });

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
