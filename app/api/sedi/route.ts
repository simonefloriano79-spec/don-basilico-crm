import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const sedi = await prisma.sede.findMany({
    where: { attiva: true },
    orderBy: { nome: "asc" },
  });
  return NextResponse.json(sedi);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  if (user.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const body = await req.json();
  const { nome, indirizzo, citta, telefono, email, slug, orarioApertura, orarioChiusura } = body;

  if (!nome || !indirizzo || !citta || !slug) {
    return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
  }

  const sede = await prisma.sede.create({
    data: { nome, indirizzo, citta, telefono, email, slug, orarioApertura, orarioChiusura },
  });

  return NextResponse.json(sede, { status: 201 });
}
