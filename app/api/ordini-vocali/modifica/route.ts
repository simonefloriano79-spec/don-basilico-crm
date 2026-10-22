import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { telefonoTessera, ripristinaSconto } from "@/lib/fedelta";
import { richiedeAccettazione } from "@/lib/accettazione";
import { finestraCliente, MAX_MODIFICHE_CLIENTE } from "@/lib/modifica-ordine";
import { righeOrdineDaArticoli } from "@/lib/ordina-righe";
import { scontoDaCodice } from "@/lib/codice-sconto";
import { inviaSmsDettaglio } from "@/lib/customer-auth/sms";
import { verificaSegretoWebhook } from "@/lib/ordini-vocali/auth";
import { elaboraRichiestaOrdine } from "@/lib/ordini-vocali/orchestrazione";
import { articoliDaRighe, euroTesto } from "@/lib/ordini-vocali/ordine-aperto";
import type { ArticoloOrdinatoInput } from "@/lib/ordini-vocali/pricing";
import { normalizzaPagamento } from "@/lib/ordini-vocali/telefono";

interface RichiestaModifica {
  ordineId: string;
  clienteTelefono: string; // serve a verificare che l'ordine sia di chi chiama
  salva?: boolean; // false/assente = solo anteprima del nuovo totale; true = applica
  annulla?: boolean; // annulla l'ordine invece di modificarlo
  articoli?: ArticoloOrdinatoInput[]; // elenco COMPLETO dopo la modifica (non solo le differenze)
  note?: string;
  nomeCitofono?: string;
  metodoPagamento?: "contanti" | "carta" | "pos";
  oraRichiesta?: string;
}

const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const rifiuto = (motivo: string) => NextResponse.json({ ok: false, esito: "errore", motivo }, { status: 200 });

// POST /api/ordini-vocali/modifica
// Il cliente richiama dopo aver ordinato («devo aggiungere una pizza», «mi sono dimenticato la mozzarella senza lattosio»,
// «annullo tutto»). Stesse regole dell'app (lib/modifica-ordine.ts): fino a 30 minuti prima dell'orario concordato, finché
// non è in preparazione, al massimo 2 modifiche. Prezzi e capienza si ricalcolano sul server; l'ordine torna «da accettare»
// (marcato MODIFICATO) e la pizzeria deve riaccettarlo: il cliente riceve un nuovo SMS di conferma.
// Va chiamato prima con salva=false (anteprima del nuovo totale da leggere al cliente) e poi con salva=true.
export async function POST(req: NextRequest) {
  if (!verificaSegretoWebhook(req)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as RichiestaModifica;
  if (!body.ordineId || !/^[0-9a-f-]{36}$/i.test(body.ordineId)) return rifiuto("Ordine non indicato");
  if (!body.clienteTelefono) return rifiuto("Manca il numero di telefono del cliente: chiedilo e richiama questo strumento");

  const ordine = await prisma.ordine.findUnique({
    where: { id: body.ordineId },
    include: { sede: true, items: true },
  });
  if (!ordine || !richiedeAccettazione(ordine)) return rifiuto("Ordine non trovato");
  // Solo chi ha fatto l'ordine (stesso numero di telefono) può cambiarlo.
  if (!ordine.clienteTelefono || telefonoTessera(ordine.clienteTelefono) !== telefonoTessera(body.clienteTelefono)) {
    return rifiuto("Questo ordine non risulta fatto con questo numero di telefono: per cambiarlo il cliente deve chiamare la pizzeria");
  }

  const f = finestraCliente(ordine);
  if (!f.puoAnnullare) return rifiuto(f.motivo ?? "L'ordine non si può più cambiare: il cliente deve chiamare la pizzeria");

  // ── Annullamento ───────────────────────────────────────────────────────────
  if (body.annulla) {
    if (body.salva !== true) {
      return NextResponse.json({ ok: true, anteprima: true, azione: "annulla", numeroOrdine: ordine.numeroOrdine, messaggio: "Chiedi conferma al cliente e richiama con salva=true per annullare l'ordine" });
    }
    const fatto = await prisma.ordine.updateMany({
      where: { id: ordine.id, stato: { in: ["nuovo", "confermato"] } },
      data: { stato: "annullato", modificatoAt: new Date() },
    });
    if (!fatto.count) return rifiuto("L'ordine è appena passato in preparazione: il cliente deve chiamare la pizzeria");
    await prisma.ordineStatoLog.create({ data: { ordineId: ordine.id, stato: "annullato", note: "Annullato dal cliente per telefono" } });
    await ripristinaSconto(ordine.id).catch((e) => console.error("Sconto fedeltà non ripristinato", e));
    if (ordine.clienteTelefono) {
      await inviaSmsDettaglio(
        ordine.clienteTelefono,
        `Don Basilico ${ordine.sede.nome.replace("Don Basilico ", "")}: ordine #${ordine.numeroOrdine} ANNULLATO come richiesto.` +
          (parseFloat(ordine.scontoFedelta.toString()) > 0 ? " Il tuo sconto fedelta torna disponibile." : "")
      ).catch((e) => console.error("SMS di annullamento non inviato", e));
    }
    return NextResponse.json({ ok: true, azione: "annullato", numeroOrdine: ordine.numeroOrdine });
  }

  // ── Modifica ───────────────────────────────────────────────────────────────
  if (!f.puoModificare) return rifiuto(f.motivo ?? `L'ordine si può modificare al massimo ${MAX_MODIFICHE_CLIENTE} volte: il cliente può annullarlo o chiamare la pizzeria`);

  const articoli: ArticoloOrdinatoInput[] = body.articoli?.length
    ? body.articoli.map((a: any) => ({
        menuItemId: String(a?.menuItemId ?? ""),
        quantita: Number(a?.quantita) || 1,
        taglia: a?.taglia === "maxi" ? "maxi" : "normale",
        ingredientiAggiuntiIds: lista(a?.ingredientiAggiuntiIds),
        ingredientiRimossi: lista(a?.ingredientiRimossi),
        impastoId: typeof a?.impastoId === "string" && a.impastoId ? a.impastoId : undefined,
        secondaMeta: typeof a?.secondaMeta === "string" && a.secondaMeta ? a.secondaMeta : undefined,
        note: typeof a?.note === "string" && a.note.trim() ? a.note.trim().slice(0, 200) : undefined,
        comboScelte: a?.comboScelte && typeof a.comboScelte === "object" ? { bibite: lista(a.comboScelte.bibite), pizze: lista(a.comboScelte.pizze) } : undefined,
      }))
    : articoliDaRighe(ordine.items);
  if (!articoli.length) return rifiuto("L'ordine non può essere vuoto: se il cliente non lo vuole più, annullalo");

  let oraNuova: Date | undefined;
  if (body.oraRichiesta) {
    oraNuova = new Date(String(body.oraRichiesta));
    if (Number.isNaN(oraNuova.getTime())) return rifiuto("Orario non valido");
  }
  // Orario attuale concordato: quello confermato dalla pizzeria, altrimenti quello richiesto se prenotato.
  const eraPrenotato = ordine.oraRichiesta.getTime() - ordine.createdAt.getTime() > 5 * 60000;
  const orarioAttuale = ordine.oraConsegnaComunicata ?? (eraPrenotato ? ordine.oraRichiesta : null);
  const orarioInvariato = !oraNuova || (!!orarioAttuale && oraNuova.getTime() === orarioAttuale.getTime());
  const oraPerIlControllo = oraNuova ?? orarioAttuale ?? undefined;

  const note = typeof body.note === "string" ? (body.note.trim().slice(0, 300) || null) : ordine.note;
  let metodoPagamento = ordine.metodoPagamento;
  if (ordine.tipo === "domicilio" && body.metodoPagamento !== undefined) {
    const m = normalizzaPagamento(body.metodoPagamento);
    if (!m) return rifiuto("Come paga il cliente? Contanti o carta");
    metodoPagamento = m;
  }
  const nomeCitofono = ordine.tipo === "domicilio" && typeof body.nomeCitofono === "string" ? (body.nomeCitofono.trim().slice(0, 80) || null) : ordine.nomeCitofono;

  const esito = await elaboraRichiestaOrdine({
    clienteNome: ordine.clienteNome ?? "",
    clienteTelefono: ordine.clienteTelefono ?? "",
    tipo: ordine.tipo as "asporto" | "domicilio",
    clienteIndirizzo: ordine.clienteIndirizzo ?? undefined,
    sedeSlugAsporto: ordine.sede.slug,
    articoli,
    note: note ?? undefined,
    oraRichiesta: oraPerIlControllo?.toISOString(),
    // I prezzi restano quelli con cui l'ordine è stato fatto: app o cassa/telefono.
    ...(ordine.canale === "online" ? { canale: "online" as const } : {}),
    escludiOrdineId: ordine.id,
  });
  if (!esito.ok) return NextResponse.json(esito, { status: 200 });
  if (esito.sedeId !== ordine.sedeId) return rifiuto("Questo ordine non si può più modificare (l'indirizzo ora è servito da un'altra pizzeria): annullalo e rifallo");

  // Totali: la consegna resta quella dell'ordine; lo sconto fedeltà già applicato resta, ma non supera i prodotti;
  // il codice sconto già usato resta, con la stessa percentuale, ricalcolato sui nuovi prodotti.
  const costoConsegna = parseFloat(ordine.costoConsegna.toString());
  const scontoApplicato = Math.min(parseFloat(ordine.scontoFedelta.toString()), esito.totale);
  let scontoCodice = 0;
  if (ordine.codiceSconto) {
    const riga = await prisma.codiceSconto.findUnique({ where: { codice: ordine.codiceSconto } });
    scontoCodice = riga ? scontoDaCodice(Number(riga.percentuale), esito.totale) : Math.min(parseFloat(ordine.scontoCodice.toString()), esito.totale);
  }
  const totale = Math.round((esito.totale + costoConsegna - scontoApplicato - scontoCodice) * 100) / 100;
  const totaleAttuale = parseFloat(ordine.totale.toString());

  const riepilogo = esito.articoli.map((a) => ({
    nome: a.nomeSnapshot,
    quantita: a.quantita,
    prezzoUnitario: a.prezzoSnapshot,
    senza: a.rimossi.map((r) => r.nome),
    conExtra: a.extra.map((e) => e.nome),
    impasto: a.impasto?.nome ?? null,
    note: a.note,
  }));

  if (body.salva !== true) {
    return NextResponse.json({
      ok: true,
      anteprima: true,
      numeroOrdine: ordine.numeroOrdine,
      totale,
      totaleAttuale,
      differenza: Math.round((totale - totaleAttuale) * 100) / 100,
      articoli: riepilogo,
      avviso: "Dopo la modifica la pizzeria deve riconfermare l'ordine e il cliente riceverà un nuovo SMS. Leggi al cliente il nuovo totale e chiedi conferma, poi richiama con salva=true",
    });
  }

  // Orario: nuovo orario → la pizzeria dovrà concordarlo di nuovo; invariato → resta quello concordato.
  const datiOrario = oraNuova && !orarioInvariato ? { oraRichiesta: oraNuova, oraConsegnaComunicata: null, modalitaConsegna: null } : {};

  const fatto = await prisma.$transaction(async (tx) => {
    // Condizioni rilette dentro la transazione: se nel frattempo la pizzeria l'ha messo in preparazione non si modifica.
    const ancora = await tx.ordine.updateMany({
      where: { id: ordine.id, stato: { in: ["nuovo", "confermato"] }, modificheCliente: ordine.modificheCliente },
      data: { modificheCliente: { increment: 1 } },
    });
    if (!ancora.count) return false;
    await tx.ordine.update({
      where: { id: ordine.id },
      data: {
        stato: "nuovo",
        stampato: false,
        modificatoAt: new Date(),
        note,
        nomeCitofono,
        totale,
        scontoFedelta: scontoApplicato,
        scontoCodice,
        metodoPagamento,
        ...datiOrario,
        items: { deleteMany: {}, create: righeOrdineDaArticoli(esito.articoli) },
      },
    });
    await tx.ordineStatoLog.create({
      data: { ordineId: ordine.id, stato: "nuovo", note: `Modificato dal cliente per telefono (modifica ${ordine.modificheCliente + 1})` },
    });
    return true;
  });
  if (!fatto) return rifiuto("L'ordine è appena passato in preparazione: il cliente deve chiamare la pizzeria");

  return NextResponse.json({
    ok: true,
    numeroOrdine: ordine.numeroOrdine,
    totale,
    totaleTesto: euroTesto(totale),
    modificheRimaste: MAX_MODIFICHE_CLIENTE - (ordine.modificheCliente + 1),
    prossimoPasso: "L'ordine è tornato in attesa: la pizzeria lo riconferma e il cliente riceve un nuovo SMS di conferma",
  });
}
