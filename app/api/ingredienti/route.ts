import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filtroIngredientiFiniti } from "@/lib/esauriti";
import { ingredientiDellaSede } from "@/lib/menu-sede";
import { leggiIngrediente } from "@/lib/ingrediente-dati";

// GET /api/ingredienti?sedeId=xxx — gli ingredienti comuni più quelli propri di quella sede (la leggono cassa e app).
// Senza sede: solo i comuni, tranne per il super admin che li vede tutti (con il nome della sede di quelli propri).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sedeId = searchParams.get("sedeId");
  const vistaGlobale = !sedeId && ((await getServerSession(authOptions))?.user as any)?.ruolo === "super_admin";

  const ingredienti = await prisma.ingrediente.findMany({
    where: vistaGlobale ? {} : ingredientiDellaSede(sedeId),
    orderBy: { nome: "asc" },
    include: {
      sede: { select: { nome: true } },
      // Solo gli ingredienti finiti «oggi» (fino alle 5:00 del giorno dopo): quelli di ieri sono già tornati disponibili.
      ...(sedeId && { disabilitati: { where: { sedeId, ...filtroIngredientiFiniti() } } }),
    },
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

// POST /api/ingredienti — il super admin lo crea per tutte le sedi; chi lavora in una sede lo crea solo per la sua.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  const isSuperAdmin = user.ruolo === "super_admin";
  if (!isSuperAdmin && !user.sedeId) return NextResponse.json({ error: "Permesso negato" }, { status: 403 });

  const dati = leggiIngrediente(await req.json(), { nuovo: true });
  if ("errore" in dati) return NextResponse.json({ error: dati.errore }, { status: 400 });

  const sedeId: string | null = isSuperAdmin ? null : user.sedeId;
  const doppio = await prisma.ingrediente.findFirst({
    where: { nome: { equals: dati.nome, mode: "insensitive" }, ...ingredientiDellaSede(sedeId) },
    select: { nome: true },
  });
  if (doppio) return NextResponse.json({ error: `«${doppio.nome}» c'è già nell'elenco` }, { status: 409 });

  const ingrediente = await prisma.ingrediente.create({ data: { ...(dati as any), sedeId } });

  return NextResponse.json(ingrediente, { status: 201 });
}
