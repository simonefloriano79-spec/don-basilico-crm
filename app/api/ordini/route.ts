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
    costoConsegna,
    items, // Array<{ menuItemId?, sedeExtraId?, nomeSnapshot, quantita, noteItem?, ingredientiRimossi?, ingredientiAggiuntiIds? }>
  } = body;

  if (!sedeId || !canale || !tipo || !items?.length) {
    return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
  }

  // Operatori e sede manager possono creare ordini solo per la propria sede
  if (user.ruolo !== "super_admin" && user.sedeId !== sedeId) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  // Ricalcola sempre il prezzo lato server: non fidarsi mai del prezzo inviato dal client
  const menuItemIds = items.filter((i: any) => i.menuItemId).map((i: any) => i.menuItemId);
  const sedeExtraIds = items.filter((i: any) => i.sedeExtraId).map((i: any) => i.sedeExtraId);
  const ingredienteIds = Array.from(new Set(items.flatMap((i: any) => i.ingredientiAggiuntiIds ?? [])));

  const [menuItemsDb, overrideDb, sedeExtraDb, ingredientiDb] = await Promise.all([
    menuItemIds.length ? prisma.menuItem.findMany({ where: { id: { in: menuItemIds } } }) : [],
    menuItemIds.length ? prisma.sedeMenuOverride.findMany({ where: { sedeId, menuItemId: { in: menuItemIds } } }) : [],
    sedeExtraIds.length ? prisma.sedeMenuExtra.findMany({ where: { id: { in: sedeExtraIds }, sedeId } }) : [],
    ingredienteIds.length ? prisma.ingrediente.findMany({ where: { id: { in: ingredienteIds as string[] } } }) : [],
  ]);

  const menuItemMap = new Map(menuItemsDb.map((m) => [m.id, m]));
  const overrideMap = new Map(overrideDb.map((o) => [o.menuItemId, o]));
  const sedeExtraMap = new Map(sedeExtraDb.map((e) => [e.id, e]));
  const ingredienteMap = new Map(ingredientiDb.map((i) => [i.id, i]));

  let totale = 0;
  let itemsData;
  try {
    itemsData = items.map((i: any) => {
      let prezzoUnitario: number;

      if (i.menuItemId) {
        const menuItem = menuItemMap.get(i.menuItemId);
        if (!menuItem) throw new Error(`Prodotto non trovato: ${i.menuItemId}`);
        const override = overrideMap.get(i.menuItemId);
        const base = override?.prezzoCustom != null
          ? parseFloat(override.prezzoCustom.toString())
          : parseFloat(menuItem.prezzoBase.toString());
        const extra = (i.ingredientiAggiuntiIds ?? []).reduce((acc: number, id: string) => {
          const ing = ingredienteMap.get(id);
          if (!ing) throw new Error(`Ingrediente non trovato: ${id}`);
          return acc + parseFloat(ing.prezzoAggiunta.toString());
        }, 0);
        prezzoUnitario = base + extra;
      } else if (i.sedeExtraId) {
        const sedeExtra = sedeExtraMap.get(i.sedeExtraId);
        if (!sedeExtra) throw new Error(`Prodotto non trovato: ${i.sedeExtraId}`);
        prezzoUnitario = parseFloat(sedeExtra.prezzo.toString());
      } else {
        throw new Error("Riga ordine senza prodotto valido");
      }

      const quantita = Math.max(1, parseInt(i.quantita) || 1);
      totale += prezzoUnitario * quantita;

      return {
        menuItemId: i.menuItemId || null,
        sedeExtraId: i.sedeExtraId || null,
        nomeSnapshot: i.nomeSnapshot,
        prezzoSnapshot: prezzoUnitario,
        quantita,
        noteItem: i.noteItem || null,
        ingredientiRimossi: i.ingredientiRimossi || [],
      };
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Prodotto non valido" }, { status: 400 });
  }

  const costoConsegnaFinale = tipo === "domicilio" ? Math.max(0, parseFloat(costoConsegna) || 0) : 0;
  totale += costoConsegnaFinale;

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
      costoConsegna: costoConsegnaFinale,
      items: { create: itemsData },
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
