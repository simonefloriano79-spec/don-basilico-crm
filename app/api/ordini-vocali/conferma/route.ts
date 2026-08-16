import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificaSegretoWebhook } from "@/lib/ordini-vocali/auth";
import { elaboraRichiestaOrdine, RichiestaOrdine } from "@/lib/ordini-vocali/orchestrazione";
import { notificaSede } from "@/lib/ordini-vocali/notifiche";

interface RichiestaConferma extends RichiestaOrdine {
  provider: string; // "vapi" | "retell"
  providerRefId: string; // id univoco della chiamata lato piattaforma voce
  telefonoChiamante?: string;
  trascrizione?: unknown;
}

// POST /api/ordini-vocali/conferma
// Tool "salva": va chiamato SOLO dopo che il cliente ha detto esplicitamente
// di sì al totale letto dall'assistente (mai prima). Rifà lo stesso calcolo
// di /prepara (mai fidarsi di un totale calcolato in una chiamata precedente
// nella conversazione: prezzi/disponibilità potrebbero essere cambiati nel
// frattempo) e salva. Idempotente su (provider, providerRefId): un retry del
// webhook con lo stesso id chiamata non crea un secondo ordine.
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

  const esistente = await prisma.interazioneLog.findUnique({
    where: { provider_providerRefId: { provider: body.provider, providerRefId: body.providerRefId } },
    include: { ordiniGenerati: { include: { ordine: true } } },
  });
  if (esistente?.ordiniGenerati?.length) {
    const ordineVocale = esistente.ordiniGenerati[0];
    return NextResponse.json({
      ok: true,
      numeroOrdine: ordineVocale.ordine?.numeroOrdine ?? ordineVocale.numeroOrdine,
      totale: parseFloat(ordineVocale.totale.toString()),
      giaConfermato: true,
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

  const indirizzoFinale = esito.indirizzoFormattato ?? body.clienteIndirizzo ?? null;

  // Transazione unica: l'ordine "vero" (visibile su /ordini, /kds, statistiche,
  // stampabile) e il log vocale nascono o falliscono insieme, mai uno senza l'altro.
  const { ordine, ordineReale } = await prisma.$transaction(async (tx) => {
    const ordineReale = await tx.ordine.create({
      data: {
        sedeId: esito.sedeId,
        canale: "telefono", // ordine telefonico, risposto dall'assistente AI invece che da uno staff
        tipo: body.tipo,
        stato: "nuovo",
        clienteNome: body.clienteNome,
        clienteTelefono: body.clienteTelefono,
        clienteIndirizzo: indirizzoFinale,
        note: body.note ?? null,
        totale: esito.totale,
        items: {
          create: esito.articoli.map((a) => ({
            menuItemId: a.menuItemId,
            nomeSnapshot: a.taglia === "maxi" ? `${a.nomeSnapshot} (Maxi)` : a.nomeSnapshot,
            prezzoSnapshot: a.prezzoSnapshot,
            quantita: a.quantita,
            noteItem:
              [a.extra.length ? `Con: ${a.extra.map((e) => e.nome).join(", ")}` : "", a.note ?? ""]
                .filter(Boolean)
                .join(" | ") || null,
          })),
        },
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
        totale: esito.totale,
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

  const sede = await prisma.sede.findUnique({ where: { id: esito.sedeId } });
  await notificaSede(sede?.telefono ?? null, {
    numeroOrdine: ordineReale.numeroOrdine,
    sedeNome: esito.sedeNome,
    clienteNome: body.clienteNome,
    clienteTelefono: body.clienteTelefono,
    tipo: body.tipo,
    clienteIndirizzo: ordine.clienteIndirizzo,
    articoli: esito.articoli,
    totale: esito.totale,
    note: body.note ?? null,
  });

  return NextResponse.json({
    ok: true,
    numeroOrdine: ordineReale.numeroOrdine,
    sede: esito.sedeNome,
    totale: esito.totale,
  });
}
