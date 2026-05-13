import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/ingredienti?sedeId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sedeId = searchParams.get("sedeId");

  const ingredienti = await prisma.ingrediente.findMany({
    orderBy: { nome: "asc" },
    include: sedeId
      ? {
          disabilitati: {
            where: { sedeId },
          },
        }
      : undefined,
  });

  // Aggiunge campo disabilitatoInSede per comodità frontend
  const result = ingredienti.map((i: any) => ({
    ...i,
    disabilitatoInSede: sedeId
      ? (i.disabilitati?.length ?? 0) > 0
      : false,
    disabilitati: undefined,
  }));

  return NextResponse.json(result);
}

// POST /api/ingredienti - crea nuovo ingrediente (solo admin)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  if (user.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const { nome, prezzoAggiunta, isAllergene } = await req.json();

  if (!nome) return NextResponse.json({ error: "Nome richiesto" }, { status: 400 });

  const ingrediente = await prisma.ingrediente.create({
    data: {
      nome,
      prezzoAggiunta: prezzoAggiunta ?? 0,
      isAllergene: isAllergene ?? false,
    },
  });

  return NextResponse.json(ingrediente, { status: 201 });
}
