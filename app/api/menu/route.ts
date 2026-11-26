import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { esauritoAttivo, filtroIngredientiFiniti, ingredienteMancante, overrideDisponibile } from "@/lib/esauriti";
import { menuDellaSede } from "@/lib/menu-sede";
import { leggiProdotto } from "@/lib/menu-prodotto";

// GET /api/menu?sedeId=xxx&tutti=1
// tutti=1 include anche i prodotti disattivati globalmente — usato dalla
// pagina di gestione Menù (serve poterli rivedere per riattivarli). Il menù
// pubblico/cliente non deve mai passarlo, altrimenti mostrerebbe prodotti
// disattivati.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sedeId = searchParams.get("sedeId");
  const includiDisattivi = searchParams.get("tutti") === "1";
  // canale=online: l'app dei clienti (e il menù pubblico) usano il «prezzo app» dove c'è; la cassa no.
  const perApp = searchParams.get("canale") === "online";

  // Senza sede si vedono solo i prodotti comuni; la vista «Tutte le sedi» del super admin li mostra tutti, con il nome della sede.
  const vistaGlobale = !sedeId && includiDisattivi && ((await getServerSession(authOptions))?.user as any)?.ruolo === "super_admin";

  const items = await prisma.menuItem.findMany({
    where: { ...(includiDisattivi ? {} : { isAttivo: true }), ...(vistaGlobale ? {} : menuDellaSede(sedeId)) },
    include: {
      ingredienti: { include: { ingrediente: true } },
      sede: { select: { nome: true } },
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
        where: { sedeId, ...filtroIngredientiFiniti() }, // solo quelli finiti «oggi» (scadono alle 5:00)
        include: { ingrediente: true },
      })
    : [];

  // Pizza maxi: se questa sede la fa, il moltiplicatore del prezzo (es. 2 = il doppio); altrimenti null.
  // (Se la lettura fallisce il menù si apre comunque, solo senza la scelta maxi.)
  const maxiSede = sedeId ? await prisma.sedePizzaMaxi.findUnique({ where: { sedeId } }).catch(() => null) : null;

  // Ingredienti finiti oggi in questa sede: le pizze che li contengono non sono disponibili (fino alle 5:00 del giorno dopo).
  const finiti = new Set(ingredientiDis.map((d) => d.ingredienteId));

  // Processa items con override
  const itemsConOverride = items.map((item) => {
    const override = sedeId
      ? (item.sedeOverride as any[])?.[0]
      : null;
    const mancante = sedeId ? ingredienteMancante((item as any).ingredienti as { ingredienteId: string; ingrediente?: { nome: string } }[], finiti) : null;
    return {
      ...item,
      // disponibileInSede = quello che vedono i clienti (attiva E non esaurita oggi E senza ingredienti finiti);
      // attivoInSede = interruttore permanente; esauritoOggi = «Esaurito» ancora valido (fino alle 5:00 del giorno dopo);
      // bloccatoDaIngrediente = nome dell'ingrediente finito che la rende non disponibile (o null).
      disponibileInSede: (override ? overrideDisponibile(override) : item.disponibileDefault) && !mancante,
      bloccatoDaIngrediente: mancante?.ingrediente?.nome ?? null,
      attivoInSede: override ? override.disponibile : item.disponibileDefault,
      esauritoOggi: override ? esauritoAttivo(override.esauritoIl) : false,
      prezzoEffettivo: override?.prezzoCustom
        ? parseFloat(override.prezzoCustom)
        : perApp && item.prezzoOnline != null
          ? parseFloat(item.prezzoOnline.toString())
          : parseFloat(item.prezzoBase.toString()),
      override,
    };
  });

  return NextResponse.json({
    maxi: maxiSede?.attiva ? { moltiplicatore: parseFloat(maxiSede.moltiplicatore.toString()) } : null,
    items: itemsConOverride,
    extra,
    ingredientiDisabilitati: ingredientiDis,
  });
}

// POST /api/menu — nuovo prodotto. Il super admin lo crea per tutte le sedi; chi lavora in una sede lo crea solo per la sua.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  const isSuperAdmin = user.ruolo === "super_admin";
  if (!isSuperAdmin && !user.sedeId) return NextResponse.json({ error: "Permesso negato" }, { status: 403 });

  const esito = leggiProdotto(await req.json(), { nuovo: true, isSuperAdmin });
  if ("errore" in esito) return NextResponse.json({ error: esito.errore }, { status: 400 });

  const { ingredientiIds, ...dati } = esito;
  const item = await prisma.menuItem.create({
    data: {
      ...(dati as any),
      sedeId: isSuperAdmin ? null : user.sedeId,
      ...(ingredientiIds?.length ? { ingredienti: { create: ingredientiIds.map((ingredienteId) => ({ ingredienteId })) } } : {}),
    },
  });

  return NextResponse.json(item, { status: 201 });
}
