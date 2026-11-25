import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORIE_IMPASTO, impastiDellaSede } from "@/lib/impasti";
import { prossimoNumeroOrdine } from "@/lib/numero-ordine";
import { calcolaOrdine, CATEGORIE_MAXI, type ArticoloPrezzato } from "@/lib/ordini-vocali/pricing";
import { CATEGORIE_BABY, prezzoBaby } from "@/lib/pizza-baby";
import { esauritoAttivo, filtroIngredientiFiniti, ingredienteMancante, overrideDisponibile } from "@/lib/esauriti";
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
    oraConsegnaComunicata,
    modalitaConsegna,
    noteDomicilio,
    nomeCitofono,
    metodoPagamento,
    tavolo,
    stampato, // true se il dispositivo che crea l'ordine stampa da sé la comanda (evita la doppia stampa automatica)
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
  const ingredienteIds = Array.from(new Set(items.flatMap((i: any) => [
    ...(i.ingredientiAggiuntiIds ?? []),
    ...(i.ingredientiRimossi ?? []),
  ])));

  const [menuItemsDb, overrideDb, sedeExtraDb, ingredientiDb, finitiDb] = await Promise.all([
    menuItemIds.length
      ? prisma.menuItem.findMany({
          where: { id: { in: menuItemIds } },
          include: { ingredienti: { select: { ingredienteId: true, ingrediente: { select: { nome: true } } } } },
        })
      : [],
    menuItemIds.length ? prisma.sedeMenuOverride.findMany({ where: { sedeId, menuItemId: { in: menuItemIds } } }) : [],
    sedeExtraIds.length ? prisma.sedeMenuExtra.findMany({ where: { id: { in: sedeExtraIds }, sedeId } }) : [],
    ingredienteIds.length ? prisma.ingrediente.findMany({ where: { id: { in: ingredienteIds as string[] } } }) : [],
    // Ingredienti finiti oggi in questa sede (scadono alle 5:00 del giorno dopo, vedi lib/esauriti.ts).
    prisma.sedeIngredienteDisabilitato.findMany({ where: { sedeId, ...filtroIngredientiFiniti() }, select: { ingredienteId: true } }),
  ]);
  const ingredientiFiniti = new Set(finitiDb.map((d) => d.ingredienteId));

  // Pizza maxi: serve sapere se la sede la fa e con che moltiplicatore.
  const maxiConfig = items.some((i: any) => i.taglia === "maxi") ? await prisma.sedePizzaMaxi.findUnique({ where: { sedeId } }) : null;

  const impastiSede = items.some((i: any) => i.impastoId) ? await impastiDellaSede(sedeId) : [];
  const impastoMap = new Map(impastiSede.map((x) => [x.id, x]));
  const menuItemMap = new Map(menuItemsDb.map((m) => [m.id, m]));
  const overrideMap = new Map(overrideDb.map((o) => [o.menuItemId, o]));
  const sedeExtraMap = new Map(sedeExtraDb.map((e) => [e.id, e]));
  const ingredienteMap = new Map(ingredientiDb.map((i) => [i.id, i]));

  // «Menù Combo»: prezzo fisso; le scelte (bibite, pizze speciali) e la disponibilità in sede le controlla lo stesso
  // calcolo dell'app clienti (lib/ordini-vocali/pricing.ts), con i prezzi della cassa.
  const comboCalcolati = new Map<number, ArticoloPrezzato>();
  try {
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      if (!it.menuItemId || menuItemMap.get(it.menuItemId)?.categoria !== "combo") continue;
      const { articoli } = await calcolaOrdine(sedeId, [{
        menuItemId: it.menuItemId, quantita: Math.max(1, parseInt(it.quantita) || 1), comboScelte: it.comboScelte,
      }]);
      comboCalcolati.set(idx, articoli[0]);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Combo non valido" }, { status: 400 });
  }

  let totale = 0;
  let itemsData;
  try {
    itemsData = items.map((i: any, idx: number) => {
      const combo = comboCalcolati.get(idx);
      if (combo) {
        totale += combo.prezzoSnapshot * combo.quantita;
        return {
          menuItemId: combo.menuItemId,
          sedeExtraId: null,
          nomeSnapshot: combo.nomeSnapshot,
          prezzoSnapshot: combo.prezzoSnapshot,
          quantita: combo.quantita,
          // Comanda: cosa contiene (prodotti fissi + scelte) e, in coda, l'eventuale nota della cassiera.
          noteItem: [combo.combo!.dettaglio, typeof i.noteItem === "string" ? i.noteItem.trim().slice(0, 200) : ""].filter(Boolean).join(" | ") || null,
          impasto: null,
          ingredientiRimossi: [] as string[],
          comboScelte: combo.combo!.scelte as unknown as object,
        };
      }

      let prezzoUnitario: number;
      let maxiRiga = false;
      let babyRiga = false;

      if (i.menuItemId) {
        const menuItem = menuItemMap.get(i.menuItemId);
        if (!menuItem) throw new Error(`Prodotto non trovato: ${i.menuItemId}`);
        const override = overrideMap.get(i.menuItemId);
        // Non si può prendere un ordine con un prodotto non disponibile in questa sede, anche se lo schermo era rimasto
        // aperto da prima: esaurito oggi, disattivato, oppure con un ingrediente finito (es. il prosciutto crudo).
        if (override ? !overrideDisponibile(override) : !menuItem.disponibileDefault) {
          throw new Error(override && override.disponibile && esauritoAttivo(override.esauritoIl)
            ? `${menuItem.nome} è esaurito in questa sede: toglilo dall'ordine`
            : `${menuItem.nome} non è disponibile in questa sede: toglilo dall'ordine`);
        }
        const manca = ingredienteMancante((menuItem as any).ingredienti as { ingredienteId: string; ingrediente: { nome: string } }[], ingredientiFiniti);
        if (manca) throw new Error(`${menuItem.nome} non è disponibile: ${manca.ingrediente.nome} è finito in questa sede. Toglilo dall'ordine`);
        const base = override?.prezzoCustom != null
          ? parseFloat(override.prezzoCustom.toString())
          : parseFloat(menuItem.prezzoBase.toString());
        const extraLordo = (i.ingredientiAggiuntiIds ?? []).reduce((acc: number, id: string) => {
          const ing = ingredienteMap.get(id);
          if (!ing) throw new Error(`Ingrediente non trovato: ${id}`);
          if (ingredientiFiniti.has(id)) throw new Error(`${ing.nome} è finito in questa sede: toglilo dagli extra di ${menuItem.nome}`);
          return acc + parseFloat(ing.prezzoAggiunta.toString());
        }, 0);
        // Compensazione: un ingrediente rimosso non genera mai uno sconto da solo,
        // ma "copre" fino al suo valore un ingrediente aggiunto al suo posto —
        // a meno che l'ingrediente non sia marcato "escluso dalla compensazione"
        // (es. Mozzarella, Pomodoro: farne a meno non "vale" credito).
        const credito = (i.ingredientiRimossi ?? []).reduce((acc: number, id: string) => {
          const ing = ingredienteMap.get(id);
          if (!ing) throw new Error(`Ingrediente non trovato: ${id}`);
          return ing.escludiCompensazione ? acc : acc + parseFloat(ing.prezzoAggiunta.toString());
        }, 0);
        const extra = Math.max(0, extraLordo - credito);
        // Impasto speciale (solo su pizze, solo se la pizzeria lo prepara): il supplemento si somma al prezzo.
        const impasto = i.impastoId ? impastoMap.get(i.impastoId) : undefined;
        if (i.impastoId && !impasto) throw new Error("L'impasto scelto non è disponibile in questa pizzeria");
        if (impasto && !CATEGORIE_IMPASTO.has(menuItem.categoria)) throw new Error(`${menuItem.nome}: l'impasto speciale non è disponibile`);
        // Pizza maxi: prezzo della pizza ed extra si moltiplicano (di norma ×2); il supplemento dell'impasto resta quello normale.
        if (i.taglia === "maxi") {
          if (!CATEGORIE_MAXI.has(menuItem.categoria)) throw new Error(`${menuItem.nome}: la versione maxi non è disponibile`);
          if (!maxiConfig?.attiva) throw new Error("La pizza maxi non è disponibile in questa pizzeria");
          maxiRiga = true;
        }
        // Pizza baby (solo cassa): 1,50 € in meno della pizza normale, extra e impasto ai prezzi normali.
        if (i.taglia === "baby") {
          if (!CATEGORIE_BABY.has(menuItem.categoria)) throw new Error(`${menuItem.nome}: la versione baby non è disponibile`);
          babyRiga = true;
        }
        const moltiplicatoreMaxi = maxiRiga ? parseFloat(maxiConfig!.moltiplicatore.toString()) : 1;
        prezzoUnitario = (babyRiga ? prezzoBaby(base) : base * moltiplicatoreMaxi) + extra * moltiplicatoreMaxi + (impasto?.supplemento ?? 0);
      } else if (i.sedeExtraId) {
        const sedeExtra = sedeExtraMap.get(i.sedeExtraId);
        if (!sedeExtra) throw new Error(`Prodotto non trovato: ${i.sedeExtraId}`);
        if (!sedeExtra.disponibile) throw new Error(`${sedeExtra.nome} non è disponibile in questa sede: toglilo dall'ordine`);
        prezzoUnitario = parseFloat(sedeExtra.prezzo.toString());
      } else {
        throw new Error("Riga ordine senza prodotto valido");
      }

      const quantita = Math.max(1, parseInt(i.quantita) || 1);
      totale += prezzoUnitario * quantita;

      return {
        menuItemId: i.menuItemId || null,
        sedeExtraId: i.sedeExtraId || null,
        nomeSnapshot: maxiRiga && !/\(maxi\)/i.test(i.nomeSnapshot ?? "") ? `${i.nomeSnapshot} (Maxi)`
          : babyRiga && !/\(baby\)/i.test(i.nomeSnapshot ?? "") ? `${i.nomeSnapshot} (Baby)` : i.nomeSnapshot,
        prezzoSnapshot: prezzoUnitario,
        quantita,
        noteItem: i.noteItem || null,
        impasto: i.impastoId ? (impastoMap.get(i.impastoId)?.nome ?? null) : null,
        ingredientiRimossi: i.ingredientiRimossi || [],
      };
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Prodotto non valido" }, { status: 400 });
  }

  const costoConsegnaFinale = tipo === "domicilio" ? Math.max(0, parseFloat(costoConsegna) || 0) : 0;
  totale += costoConsegnaFinale;

  // Domicilio: «appena possibile» / «non prima» + orario di consegna. Asporto: solo l'orario di ritiro («alle ore»).
  const modalitaConsegnaValida = ["appena_possibile", "non_prima"].includes(modalitaConsegna) ? modalitaConsegna : null;
  const oraComunicataValida = oraConsegnaComunicata ? new Date(oraConsegnaComunicata) : null;
  const orarioOk = !!oraComunicataValida && !Number.isNaN(oraComunicataValida.getTime());
  const oraConsegnaComunicataFinale = (tipo === "domicilio" || tipo === "asporto") && orarioOk ? oraComunicataValida : null;
  const modalitaConsegnaFinale = tipo === "domicilio" ? modalitaConsegnaValida
    : tipo === "asporto" && oraConsegnaComunicataFinale ? "alle_ore" : null;
  const noteDomicilioFinale = tipo === "domicilio" ? (noteDomicilio || null) : null;
  const nomeCitofonoFinale = tipo === "domicilio" ? (nomeCitofono || null) : null;
  const tavoloFinale = tipo === "tavolo" && typeof tavolo === "string" && tavolo.trim() ? tavolo.trim().slice(0, 40) : null;
  if (tipo === "tavolo" && !tavoloFinale) {
    return NextResponse.json({ error: "Indica il tavolo (numero o nome)" }, { status: 400 });
  }
  const metodoPagamentoFinale = ["contanti", "pos"].includes(metodoPagamento) ? metodoPagamento : null;

  // Se non è stato selezionato un cliente esistente ma è stato inserito un telefono,
  // collega l'ordine all'anagrafica cliente corrispondente (creandola se non esiste).
  let clienteIdFinale = clienteId || null;
  if (!clienteIdFinale && clienteTelefono) {
    const clienteEsistente = await prisma.cliente.findFirst({ where: { telefono: clienteTelefono } });
    clienteIdFinale = clienteEsistente
      ? clienteEsistente.id
      : (await prisma.cliente.create({
          data: {
            nome: clienteNome || "Cliente",
            telefono: clienteTelefono,
            indirizzoDefault: clienteIndirizzo || null,
          },
        })).id;
  }

  const numeroOrdine = await prossimoNumeroOrdine(sedeId, oraConsegnaComunicataFinale);

  const ordine = await prisma.ordine.create({
    data: {
      sedeId,
      ...(numeroOrdine !== undefined ? { numeroOrdine } : {}),
      canale,
      tipo,
      stato: "nuovo",
      clienteId: clienteIdFinale,
      operatoreId: canale !== "online" ? user.id : null,
      clienteNome,
      clienteTelefono,
      clienteIndirizzo,
      nomeCitofono: nomeCitofonoFinale,
      tavolo: tavoloFinale,
      ...(stampato === true ? { stampato: true } : {}),
      note,
      noteDomicilio: noteDomicilioFinale,
      oraConsegnaComunicata: oraConsegnaComunicataFinale,
      modalitaConsegna: modalitaConsegnaFinale,
      metodoPagamento: metodoPagamentoFinale,
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
