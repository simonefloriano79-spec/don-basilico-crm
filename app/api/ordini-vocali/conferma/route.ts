import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { prossimoNumeroOrdine } from "@/lib/numero-ordine";
import { righeOrdineDaArticoli } from "@/lib/ordina-righe";
import { assicuraTessera, statoTessera, usaSconto as usaScontoTessera } from "@/lib/fedelta";
import { normalizzaCodice, scontoDaCodice, verificaCodice } from "@/lib/codice-sconto";
import { trovaClientePerTelefono } from "@/lib/ordini-vocali/cliente";
import { verificaSegretoWebhook } from "@/lib/ordini-vocali/auth";
import { elaboraRichiestaOrdine } from "@/lib/ordini-vocali/orchestrazione";
import { notificaSede } from "@/lib/ordini-vocali/notifiche";
import {
  RichiestaTelefonica,
  nomeCitofonoPulito,
  normalizzaPagamento,
  senzaItalia,
  totaliTelefonici,
  validaDatiTelefonici,
} from "@/lib/ordini-vocali/telefono";

interface RichiestaConferma extends RichiestaTelefonica {
  provider: string; // "vapi" | "retell"
  providerRefId: string; // id univoco della chiamata lato piattaforma voce
  telefonoChiamante?: string;
  trascrizione?: unknown;
}

const PROSSIMO_PASSO =
  "L'ordine è in attesa: la pizzeria lo conferma (anche con un orario diverso) e il cliente riceve un SMS di conferma al suo numero";

// Risposta per una chiamata già confermata (retry del webhook con lo stesso id chiamata).
async function ordineGiaConfermato(provider: string, providerRefId: string) {
  const esistente = await prisma.interazioneLog.findUnique({
    where: { provider_providerRefId: { provider, providerRefId } },
    include: { ordiniGenerati: { include: { ordine: true } } },
  });
  const ordineVocale = esistente?.ordiniGenerati?.[0];
  if (!ordineVocale) return null;
  return {
    ok: true,
    numeroOrdine: ordineVocale.ordine?.numeroOrdine ?? ordineVocale.numeroOrdine,
    totale: parseFloat(ordineVocale.totale.toString()),
    giaConfermato: true,
    prossimoPasso: PROSSIMO_PASSO,
  };
}

// POST /api/ordini-vocali/conferma
// Tool "salva": va chiamato SOLO dopo che il cliente ha detto esplicitamente
// di sì al totale letto dall'assistente (mai prima). Rifà lo stesso calcolo
// di /prepara (mai fidarsi di un totale calcolato in una chiamata precedente
// nella conversazione: prezzi/disponibilità potrebbero essere cambiati nel
// frattempo) e salva. Idempotente su (provider, providerRefId): un retry del
// webhook con lo stesso id chiamata non crea un secondo ordine.
//
// L'ordine nasce «nuovo» + daAssistente = DA ACCETTARE, come quelli dell'app: la pizzeria lo accetta (o lo rifiuta)
// dalla pagina Ordini e solo allora il cliente riceve l'SMS di conferma. Il timbro della tessera arriva a ordine pronto.
export async function POST(req: NextRequest) {
  if (!verificaSegretoWebhook(req)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = (await req.json()) as RichiestaConferma;

  if (!body.provider || !body.providerRefId) {
    return NextResponse.json({ ok: false, esito: "errore", motivo: "provider/providerRefId richiesti" }, { status: 400 });
  }
  if (!body.clienteNome || !body.clienteTelefono || !body.tipo || !body.articoli?.length) {
    return NextResponse.json({ ok: false, esito: "errore", motivo: "Dati ordine incompleti" }, { status: 400 });
  }

  const giaFatto = await ordineGiaConfermato(body.provider, body.providerRefId);
  if (giaFatto) return NextResponse.json(giaFatto);

  const mancante = validaDatiTelefonici(body);
  if (mancante) return NextResponse.json({ ok: false, esito: "errore", motivo: mancante }, { status: 200 });

  const codiceRichiesto = body.codiceSconto ? normalizzaCodice(body.codiceSconto) : "";
  const vuoleSconto = body.usaScontoFedelta === true;
  if (codiceRichiesto && vuoleSconto) {
    return NextResponse.json({
      ok: false,
      esito: "errore",
      motivo: "Il codice sconto non si somma allo sconto fedeltà: il cliente deve sceglierne uno solo per questo ordine",
    });
  }

  const esito = await elaboraRichiestaOrdine(body);

  if (!esito.ok) {
    await prisma.interazioneLog.create({
      data: {
        canale: "voce",
        provider: body.provider,
        providerRefId: body.providerRefId,
        telefonoChiamante: body.telefonoChiamante ?? body.clienteTelefono,
        trascrizione: body.trascrizione as any,
        esito: esito.esito,
        sedeId: esito.sedeId ?? null,
        payloadRaw: body as any,
      },
    });
    return NextResponse.json(esito, { status: 200 });
  }

  const domicilio = body.tipo === "domicilio";
  const indirizzoFinale = senzaItalia(esito.indirizzoFormattato ?? body.clienteIndirizzo ?? null);
  const nomeCitofono = nomeCitofonoPulito(body);
  const metodoPagamento = domicilio ? normalizzaPagamento(body.metodoPagamento) : null;
  const orarioScelto = !!body.oraRichiesta;

  // Come fa la cassa: l'ordine si lega all'anagrafica cliente per telefono (creandola se non c'è),
  // così lo storico, il riconoscimento alla prossima chiamata e gli sconti per cliente funzionano.
  const clienteEsistente = await trovaClientePerTelefono(body.clienteTelefono);
  const cliente =
    clienteEsistente ??
    (await prisma.cliente.create({
      data: { nome: body.clienteNome, telefono: body.clienteTelefono, indirizzoDefault: indirizzoFinale },
    }));

  const sede = await prisma.sede.findUnique({ where: { id: esito.sedeId } });
  if (!sede) return NextResponse.json({ ok: false, esito: "errore", motivo: "Sede non trovata" });

  // Tessera fedeltà: se il cliente ha già dato il consenso privacy (registrato nell'app) la tessera si crea da sé come per
  // gli ordini dell'app; altrimenti solo se, a voce, ha detto sì (attivaTessera): la chiamata registrata fa da prova.
  const consensoTessera = cliente.privacyAt
    ? { consensoAt: cliente.privacyAt, marketing: !!cliente.marketingAt }
    : body.attivaTessera === true
      ? { consensoAt: new Date(), marketing: false }
      : null;

  // Transazione unica: l'ordine "vero" (visibile su /ordini, /kds, statistiche,
  // stampabile) e il log vocale nascono o falliscono insieme, mai uno senza l'altro.
  const numeroOrdine = await prossimoNumeroOrdine(esito.sedeId, esito.oraRichiesta);
  const ordineId = randomUUID();
  let scontoFedelta = 0;
  let scontoCodice = 0;
  let codiceUsato: string | null = null;
  let totali = totaliTelefonici(body.tipo, esito.totale);

  let creati;
  try {
    creati = await prisma.$transaction(async (tx) => {
      if (consensoTessera) {
        await assicuraTessera(tx, {
          nome: cliente.nome, telefono: body.clienteTelefono, sedeSlug: sede.slug,
          marketing: consensoTessera.marketing, consensoAt: consensoTessera.consensoAt,
        });
      }

      if (codiceRichiesto) {
        // Si blocca la riga del cliente: due ordini contemporanei non possono usare lo stesso codice due volte...
        await tx.$queryRaw`SELECT id FROM clienti WHERE id = ${cliente.id}::uuid FOR UPDATE`;
        // ...e quella del codice: con un limite di utilizzi totali, due clienti insieme non superano il tetto.
        await tx.$queryRaw`SELECT id FROM codici_sconto WHERE codice = ${codiceRichiesto} FOR UPDATE`;
        const c = await verificaCodice(tx, codiceRichiesto, cliente.id, { totaleProdotti: esito.totale });
        if (!c.ok) throw new Error(`CODICE_NON_VALIDO:${c.motivo}`);
        scontoCodice = Math.min(scontoDaCodice(c.percentuale, esito.totale), esito.totale);
        codiceUsato = c.codice;
      }

      if (vuoleSconto) {
        const stato = await statoTessera(body.clienteTelefono, tx, true);
        if (!stato || !stato.scontoDisponibile) throw new Error("SCONTO_NON_DISPONIBILE");
        const pieno = await usaScontoTessera(tx, stato, ordineId);
        // Lo sconto si applica ai prodotti (la consegna non conta): se li supera i prodotti sono gratis e il resto si perde.
        scontoFedelta = Math.min(pieno, esito.totale);
      }

      totali = totaliTelefonici(body.tipo, esito.totale, scontoFedelta, scontoCodice);

      const ordineReale = await tx.ordine.create({
        data: {
          id: ordineId,
          sedeId: esito.sedeId,
          ...(numeroOrdine !== undefined ? { numeroOrdine } : {}),
          canale: "telefono", // ordine telefonico, risposto dall'assistente AI invece che da uno staff
          daAssistente: true, // nasce «da accettare» come gli ordini dell'app
          tipo: body.tipo,
          stato: "nuovo",
          clienteId: cliente.id,
          clienteNome: body.clienteNome,
          clienteTelefono: body.clienteTelefono,
          clienteIndirizzo: indirizzoFinale,
          nomeCitofono,
          note: body.note ?? null,
          oraRichiesta: esito.oraRichiesta,
          totale: totali.totale,
          costoConsegna: totali.costoConsegna,
          scontoFedelta,
          codiceSconto: codiceUsato,
          scontoCodice,
          metodoPagamento,
          items: { create: righeOrdineDaArticoli(esito.articoli) },
        },
      });

      await tx.ordineStatoLog.create({
        data: { ordineId: ordineReale.id, stato: "nuovo" },
      });

      const ordine = await tx.ordineVocale.create({
        data: {
          ordineId: ordineReale.id,
          sedeId: esito.sedeId,
          clienteNome: body.clienteNome,
          clienteTelefono: body.clienteTelefono,
          tipo: body.tipo,
          clienteIndirizzo: indirizzoFinale,
          indirizzoLat: esito.indirizzoLat ?? null,
          indirizzoLng: esito.indirizzoLng ?? null,
          articoli: esito.articoli as any,
          totale: totali.totale,
          note: body.note ?? null,
          oraRichiesta: esito.oraRichiesta,
        },
      });

      await tx.interazioneLog.create({
        data: {
          canale: "voce",
          provider: body.provider,
          providerRefId: body.providerRefId,
          telefonoChiamante: body.telefonoChiamante ?? body.clienteTelefono,
          trascrizione: body.trascrizione as any,
          esito: "confermato",
          sedeId: esito.sedeId,
          ordineVocaleId: ordine.id,
          payloadRaw: body as any,
        },
      });

      return { ordine, ordineReale };
    });
  } catch (e: any) {
    if (typeof e?.message === "string" && e.message.startsWith("CODICE_NON_VALIDO:")) {
      return NextResponse.json({ ok: false, esito: "errore", motivo: e.message.slice("CODICE_NON_VALIDO:".length) });
    }
    if (e?.message === "SCONTO_NON_DISPONIBILE") {
      return NextResponse.json({ ok: false, esito: "errore", motivo: "Lo sconto fedeltà non è più disponibile" });
    }
    // Due richieste con la stessa chiamata arrivate insieme: la seconda trova il log già scritto dalla prima.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const giaFatto2 = await ordineGiaConfermato(body.provider, body.providerRefId);
      if (giaFatto2) return NextResponse.json(giaFatto2);
    }
    throw e;
  }

  const { ordine, ordineReale } = creati;
  await notificaSede(sede.telefono ?? null, {
    numeroOrdine: ordineReale.numeroOrdine,
    sedeNome: esito.sedeNome,
    clienteNome: body.clienteNome,
    clienteTelefono: body.clienteTelefono,
    tipo: body.tipo,
    clienteIndirizzo: ordine.clienteIndirizzo,
    nomeCitofono,
    metodoPagamento,
    oraRichiesta: orarioScelto ? esito.oraRichiesta : null,
    articoli: esito.articoli,
    costoConsegna: totali.costoConsegna,
    scontoFedelta,
    scontoCodice,
    totale: totali.totale,
    note: body.note ?? null,
  });

  return NextResponse.json({
    ok: true,
    numeroOrdine: ordineReale.numeroOrdine,
    sede: esito.sedeNome,
    totale: totali.totale,
    prossimoPasso: PROSSIMO_PASSO,
  });
}
