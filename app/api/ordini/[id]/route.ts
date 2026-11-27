import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timbraOrdine, ripristinaSconto } from "@/lib/fedelta";
import { richiedeAccettazione } from "@/lib/accettazione";
import { inviaPushCliente } from "@/lib/push";
import { prezzaRigheCassa } from "@/lib/ordini-cassa";

// GET /api/ordini/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;

  const ordine = await prisma.ordine.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: {
          menuItem: { select: { nome: true, categoria: true } },
          sedeExtra: { select: { nome: true, categoria: true } },
        },
      },
      sede: true,
      cliente: true,
      statiLog: {
        include: { utente: { select: { nome: true, cognome: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ordine) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  if (user.ruolo !== "super_admin" && ordine.sedeId !== user.sedeId) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  return NextResponse.json(ordine);
}

// PATCH /api/ordini/[id] - aggiorna stato o stampato
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const body = await req.json();
  const user = session.user as any;
  const { stato, stampato, note, pagato } = body;

  const STATI_FLOW = ["nuovo", "confermato", "in_preparazione", "pronto", "consegnato", "annullato"];

  const ordineAttuale = await prisma.ordine.findUnique({ where: { id: params.id } });
  if (!ordineAttuale) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  if (user.ruolo !== "super_admin" && ordineAttuale.sedeId !== user.sedeId) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  // Validazione avanzamento stato
  if (stato) {
    const idx = STATI_FLOW.indexOf(ordineAttuale.stato);
    const newIdx = STATI_FLOW.indexOf(stato);
    if (newIdx < 0) return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
  }

  const ordineAggiornato = await prisma.ordine.update({
    where: { id: params.id },
    data: {
      ...(stato && { stato }),
      ...(stampato !== undefined && { stampato }),
      ...(pagato !== undefined && { pagato }),
      ...(stato === "pronto" && { oraEffettivaPronte: new Date() }),
    },
    include: { items: true, sede: { select: { nome: true } } },
  });

  // Log cambio stato
  if (stato) {
    await prisma.ordineStatoLog.create({
      data: {
        ordineId: params.id,
        stato,
        utenteId: user.id,
        note,
      },
    });
  }

  // Tessera fedeltà (ordini del sito): timbro quando l'ordine è pronto/consegnato; se l'ordine viene annullato
  // lo sconto eventualmente usato torna disponibile. Best-effort: non deve mai bloccare il cambio di stato.
  if (stato === "pronto" || stato === "consegnato") {
    await timbraOrdine(params.id).catch((e) => console.error("Timbro fedeltà non assegnato", e));
  } else if (stato === "annullato") {
    await ripristinaSconto(params.id).catch((e) => console.error("Sconto fedeltà non ripristinato", e));
  }

  // Notifica push al cliente dell'app quando l'ordine diventa pronto (solo ordini online, una volta sola).
  if (stato === "pronto" && ordineAttuale.stato !== "pronto" && richiedeAccettazione(ordineAttuale)) {
    const sede = ordineAggiornato.sede.nome.replace("Don Basilico ", "");
    await inviaPushCliente(ordineAttuale.clienteId, {
      titolo: `Ordine #${ordineAttuale.numeroOrdine} pronto!`,
      testo: ordineAttuale.tipo === "domicilio" ? "È pronto e a breve parte per la consegna." : `Puoi ritirarlo da Don Basilico ${sede}.`,
      tag: `ordine-${ordineAttuale.id}`,
    });
  }

  return NextResponse.json(ordineAggiornato);
}

// PUT /api/ordini/[id] — MODIFICA di un ordine già confermato dalla cassa (il cliente richiama: «aggiungi / togli / cambia una pizza»).
// Le righe si sostituiscono per intero e il prezzo si ricalcola sul server con le stesse regole di un ordine nuovo. L'ordine resta
// lo stesso (stesso numero); la comanda va stampata di nuovo con la scritta «ORDINE MODIFICATO». Gli ordini dell'app clienti o
// dell'assistente vocale hanno il loro percorso (il cliente li modifica dall'app, la pizzeria li riaccetta): qui non si toccano.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;
  const body = await req.json();

  const ordine = await prisma.ordine.findUnique({ where: { id: params.id }, include: { items: true } });
  if (!ordine) return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 });
  if (user.ruolo !== "super_admin" && ordine.sedeId !== user.sedeId) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }
  if (richiedeAccettazione(ordine)) {
    return NextResponse.json({ error: "Gli ordini dell'app o dell'assistente vocale non si modificano da qui: li cambia il cliente dall'app, oppure annulla e rifai l'ordine" }, { status: 400 });
  }
  if (["consegnato", "annullato"].includes(ordine.stato)) {
    return NextResponse.json({ error: "Questo ordine è già chiuso: non si può più modificare" }, { status: 400 });
  }
  if (ordine.stripePaymentId || parseFloat(ordine.scontoFedelta.toString()) > 0 || parseFloat(ordine.scontoCodice.toString()) > 0) {
    return NextResponse.json({ error: "Ordine con pagamento online o sconto applicato: non si può modificare da qui" }, { status: 400 });
  }

  const { items, clienteNome, clienteTelefono, clienteIndirizzo, nomeCitofono, note, noteDomicilio, tavolo, oraConsegnaComunicata, modalitaConsegna, metodoPagamento, costoConsegna, stampato } = body;
  if (!Array.isArray(items) || !items.length) return NextResponse.json({ error: "L'ordine deve avere almeno un prodotto (per cancellarlo usa «Annulla ordine»)" }, { status: 400 });

  let esito;
  try {
    esito = await prezzaRigheCassa(ordine.sedeId, items, ordine.items as any);
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Prodotto non valido" }, { status: 400 });
  }

  // Tipo e canale restano quelli dell'ordine; stesse regole di un ordine nuovo per consegna, orario e tavolo.
  const tipo = ordine.tipo;
  const costoConsegnaFinale = tipo === "domicilio" ? Math.max(0, parseFloat(costoConsegna) || 0) : 0;
  const totale = Math.round((esito.totale + costoConsegnaFinale) * 100) / 100;
  const modalitaValida = modalitaConsegna === "non_prima" ? "non_prima" : "alle_ore";
  const oraValida = oraConsegnaComunicata ? new Date(oraConsegnaComunicata) : null;
  const orarioOk = !!oraValida && !Number.isNaN(oraValida.getTime());
  const oraFinale = (tipo === "domicilio" || tipo === "asporto") && orarioOk ? oraValida : null;
  const modalitaFinale = tipo === "domicilio" ? (oraFinale ? modalitaValida : null) : tipo === "asporto" && oraFinale ? "alle_ore" : null;
  const tavoloFinale = tipo === "tavolo" && typeof tavolo === "string" && tavolo.trim() ? tavolo.trim().slice(0, 40) : null;
  if (tipo === "tavolo" && !tavoloFinale) return NextResponse.json({ error: "Indica il tavolo (numero o nome)" }, { status: 400 });

  // Se era già «pronto» e il cliente aggiunge qualcosa, torna in preparazione; negli altri stati resta dov'è.
  const nuovoStato = ordine.stato === "pronto" ? "in_preparazione" : ordine.stato;

  const aggiornato = await prisma.$transaction(async (tx) => {
    const o = await tx.ordine.update({
      where: { id: ordine.id },
      data: {
        stato: nuovoStato,
        // stampato = true solo se questa schermata stampa da sé la nuova comanda; altrimenti la ripresa la stampa automatica del PC.
        stampato: stampato === true,
        modificatoAt: new Date(),
        clienteNome: clienteNome || ordine.clienteNome,
        clienteTelefono: clienteTelefono || null,
        clienteIndirizzo: tipo === "domicilio" ? (clienteIndirizzo || null) : null,
        nomeCitofono: tipo === "domicilio" ? (nomeCitofono || null) : null,
        note: note || null,
        noteDomicilio: tipo === "domicilio" ? (noteDomicilio || null) : null,
        tavolo: tavoloFinale,
        oraConsegnaComunicata: oraFinale,
        modalitaConsegna: modalitaFinale,
        metodoPagamento: ["contanti", "pos"].includes(metodoPagamento) ? metodoPagamento : null,
        costoConsegna: costoConsegnaFinale,
        totale,
        items: { deleteMany: {}, create: esito.itemsData as any },
      },
      include: { items: true, sede: { select: { nome: true } } },
    });
    await tx.ordineStatoLog.create({ data: { ordineId: ordine.id, stato: nuovoStato, utenteId: user.id, note: "Ordine modificato dalla cassa" } });
    return o;
  });

  return NextResponse.json(aggiornato);
}

// DELETE /api/ordini/[id] — cancellazione DEFINITIVA, solo per il super admin e solo per ordini già ANNULLATI
// (prove, errori di battitura). Non si torna indietro: sparisce anche da Conti e Statistiche (gli annullati non contavano comunque).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;
  if (user.ruolo !== "super_admin") return NextResponse.json({ error: "Solo il super admin può eliminare gli ordini" }, { status: 403 });

  const ordine = await prisma.ordine.findUnique({ where: { id: params.id }, select: { id: true, numeroOrdine: true, stato: true } });
  if (!ordine) return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 });
  if (ordine.stato !== "annullato") return NextResponse.json({ error: "Si possono eliminare solo gli ordini annullati: annulla prima l'ordine" }, { status: 400 });

  try {
    await prisma.$transaction([
      // L'ordine vocale resta, ma senza il collegamento all'ordine che sparisce.
      prisma.ordineVocale.updateMany({ where: { ordineId: ordine.id }, data: { ordineId: null } }),
      // La consegna dell'app rider (stesso database), se c'è.
      prisma.$executeRaw`DELETE FROM consegne WHERE ordine_id = ${ordine.id}::uuid`,
      // Righe e storico stati si cancellano a cascata.
      prisma.ordine.delete({ where: { id: ordine.id } }),
    ]);
  } catch (e: any) {
    console.error("Eliminazione ordine fallita:", e?.message ?? e);
    return NextResponse.json({ error: "Non riesco a eliminare l'ordine (è collegato ad altri dati)" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, numero: ordine.numeroOrdine });
}
