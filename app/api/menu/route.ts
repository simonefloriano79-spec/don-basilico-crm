import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/menu?sedeId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sedeId = searchParams.get("sedeId");

  // Items base attivi
  const items = await prisma.menuItem.findMany({
    where: { isAttivo: true },
    include: {
      ingredienti: { include: { ingrediente: true } },
      ...(sedeId && {
        sedeOverride: {
          where: { sedeId },
        },
      }),
    },
    orderBy: [{ categoria: "asc" }, { ordineVisualizzazione: "asc" }],
  });

  // Extra esclusivi della sede
  const extra = sedeId
    ? await prisma.sedeMenuExtra.findMany({
        where: { sedeId, disponibile: true },
        orderBy: { ordineVisualizzazione: "asc" },
      })
    : [];

  // Ingredienti disabilitati nella sede
  const ingredientiDis = sedeId
    ? await prisma.sedeIngredienteDisabilitato.findMany({
        where: { sedeId },
        include: { ingrediente: true },
      })
    : [];

  // Processa items con override
  const itemsConOverride = items.map((item: any) => {
    const override = sedeId
      ? (item.sedeOverride as any[])?.[0]
      : null;
    return {
      ...item,
      disponibileInSede: override ? override.disponibile : item.disponibileDefault,
      prezzoEffettivo: override?.prezzoCustom
        ? parseFloat(override.prezzoCustom)
        : parseFloat(item.prezzoBase.toString()),
      override,
    };
  });

  return NextResponse.json({
    items: itemsConOverride,
    extra,
    ingredientiDisabilitati: ingredientiDis,
  });
}

// POST /api/menu - crea nuovo item (solo super_admin)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  if (user.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const body = await req.json();
  const { nome, descrizione, categoria, prezzoBase, immagineUrl, ordineVisualizzazione } = body;

  if (!nome || !categoria || !prezzoBase) {
    return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
  }

  const item = await prisma.menuItem.create({
    data: { nome, descrizione, categoria, prezzoBase, immagineUrl, ordineVisualizzazione: ordineVisualizzazione ?? 0 },
  });

  return NextResponse.json(item, { status: 201 });
}
