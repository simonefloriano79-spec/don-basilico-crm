import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prossimoNumeroOrdine } from "@/lib/numero-ordine";
import { prezzaRigheCassa } from "@/lib/ordini-cassa";
import { scontoCassaValido } from "@/lib/sconto-cassa";
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
    sconto,
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

  // Ricalcola sempre il prezzo lato server: non fidarsi mai del prezzo inviato dal client (regole in lib/ordini-cassa.ts).
  let totale = 0;
  let itemsData;
  try {
    ({ itemsData, totale } = await prezzaRigheCassa(sedeId, items));
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Prodotto non valido" }, { status: 400 });
  }


  const costoConsegnaFinale = tipo === "domicilio" ? Math.max(0, parseFloat(costoConsegna) || 0) : 0;
  totale += costoConsegnaFinale;
  const scontoCassa = scontoCassaValido(sconto, totale);
  totale = Math.round((totale - scontoCassa) * 100) / 100;

  // Domicilio: orario di consegna «alle ore» oppure «non prima». Asporto: solo l'orario di ritiro («alle ore»).
  const modalitaConsegnaValida = modalitaConsegna === "non_prima" ? "non_prima" : "alle_ore";
  const oraComunicataValida = oraConsegnaComunicata ? new Date(oraConsegnaComunicata) : null;
  const orarioOk = !!oraComunicataValida && !Number.isNaN(oraComunicataValida.getTime());
  const oraConsegnaComunicataFinale = (tipo === "domicilio" || tipo === "asporto") && orarioOk ? oraComunicataValida : null;
  const modalitaConsegnaFinale = tipo === "domicilio" ? (oraConsegnaComunicataFinale ? modalitaConsegnaValida : null)
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
      scontoCassa,
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
