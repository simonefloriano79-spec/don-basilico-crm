import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET /api/utenti — lista utenti (solo super_admin)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  if (user.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const utenti = await prisma.utente.findMany({
    include: { sede: { select: { nome: true } } },
    orderBy: [{ ruolo: "asc" }, { cognome: "asc" }],
  });

  // Non esporre mai il passwordHash
  return NextResponse.json(
    utenti.map(({ passwordHash: _, ...u }) => u)
  );
}

// POST /api/utenti — crea nuovo utente (solo super_admin)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  if (user.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const body = await req.json();
  const { email, nome, cognome, ruolo, sedeId, password } = body;

  if (!email || !nome || !cognome || !password) {
    return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const utente = await prisma.utente.create({
    data: { email, nome, cognome, ruolo: ruolo ?? "operatore", sedeId: sedeId ?? null, passwordHash },
    include: { sede: { select: { nome: true } } },
  });

  const { passwordHash: _, ...utenteClean } = utente;
  return NextResponse.json(utenteClean, { status: 201 });
}
