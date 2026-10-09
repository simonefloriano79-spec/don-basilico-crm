import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clienteIdDaRichiesta } from "@/lib/customer-auth/session";
import { elaboraRichiestaOrdine, RichiestaOrdine } from "@/lib/ordini-vocali/orchestrazione";
import { ArticoloOrdinatoInput } from "@/lib/ordini-vocali/pricing";
import { generaSlot } from "@/lib/slot-ritiro";
import { disponibilitaSlot, pesoRiga } from "@/lib/capacita-pizze";
import { finestraCliente, MAX_MODIFICHE_CLIENTE } from "@/lib/modifica-ordine";
import { righeOrdineDaArticoli } from "@/lib/ordina-righe";

const METODI_PAGAMENTO = ["contanti", "carta"];

const lista = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

// PATCH /api/ordina/ordini/[id] — il cliente modifica un suo ordine (prodotti, impasto, note, orario, pagamento).
// Tipo di ordine, sede e indirizzo non si cambiano (per quelli si annulla e si rifà). Si può solo nella finestra
// consentita (lib/modifica-ordine.ts) e al massimo 2 volte. Prezzi e capienza si ricalcolano sul server come alla
// creazione. L'ordine torna «da accettare» (con la marcatura MODIFICATO) e la comanda va ristampata.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const clienteId = clienteIdDaRichiesta(req);
  if (!clienteId) return NextResponse.json({ error: "Sessione scaduta, accedi di nuovo" }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 });

  const ordine = await prisma.ordine.findFirst({
    where: { id: params.id, clienteId, canale: "online" },
    include: { sede: true },
  });
  if (!ordine) return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 });

  const f = finestraCliente(ordine);
  if (!f.puoAnnullare) return NextResponse.json({ error: f.motivo ?? "L'ordine non si può più modificare" }, { status: 409 });
  if (!f.puoModificare) {
    return NextResponse.json({ error: f.motivo ?? `L'ordine si può modificare al massimo ${MAX_MODIFICHE_CLIENTE} volte` }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));

  let oraRitiro: Date | undefined;
  if (body.oraRitiro) {
    oraRitiro = new Date(String(body.oraRitiro));
    if (Number.isNaN(oraRitiro.getTime())) return NextResponse.json({ error: "Orario non valido" }, { status: 400 });
  }

  let metodoPagamento = ordine.metodoPagamento;
  if (ordine.tipo === "domicilio" && body.metodoPagamento !== undefined) {
    const m = String(body.metodoPagamento);
    if (!METODI_PAGAMENTO.includes(m)) return NextResponse.json({ error: "Scegli come pagare: contanti o carta" }, { status: 400 });
    metodoPagamento = m;
  }

  const articoli: ArticoloOrdinatoInput[] = (Array.isArray(body.articoli) ? body.articoli : []).map((a: any) => ({
    menuItemId: String(a?.menuItemId ?? ""),
    quantita: Number(a?.quantita) || 1,
    taglia: a?.taglia === "maxi" ? "maxi" : "normale",
    ingredientiAggiuntiIds: lista(a?.ingredientiAggiuntiIds),
    ingredientiRimossi: lista(a?.ingredientiRimossi),
    impastoId: typeof a?.impastoId === "string" && a.impastoId ? a.impastoId : undefined,
    note: typeof a?.note === "string" && a.note.trim() ? a.note.trim().slice(0, 200) : undefined,
  }));
  if (!articoli.length) return NextResponse.json({ error: "L'ordine non può essere vuoto: se non lo vuoi più, annullalo" }, { status: 400 });

  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : null;

  const richiesta: RichiestaOrdine = {
    clienteNome: ordine.clienteNome ?? "",
    clienteTelefono: ordine.clienteTelefono ?? "",
    tipo: ordine.tipo as "asporto" | "domicilio",
    clienteIndirizzo: ordine.clienteIndirizzo ?? undefined,
    sedeSlugAsporto: ordine.sede.slug,
    articoli,
    note: note ?? undefined,
    oraRichiesta: oraRitiro?.toISOString(),
  };
  const esito = await elaboraRichiestaOrdine(richiesta);
  if (!esito.ok) return NextResponse.json({ error: esito.motivo, esito: esito.esito }, { status: 422 });
  if (esito.sedeId !== ordine.sedeId) {
    return NextResponse.json({ error: "Questo ordine non si può più modificare (l'indirizzo ora è servito da un'altra pizzeria): annullalo e rifallo." }, { status: 409 });
  }

  // Orario attuale concordato: quello confermato dalla pizzeria, altrimenti quello richiesto se prenotato.
  const eraPrenotato = ordine.oraRichiesta.getTime() - ordine.createdAt.getTime() > 5 * 60000;
  const orarioAttuale = ordine.oraConsegnaComunicata ?? (eraPrenotato ? ordine.oraRichiesta : null);
  const orarioInvariato = !!oraRitiro && !!orarioAttuale && oraRitiro.getTime() === orarioAttuale.getTime();

  // Con un orario NUOVO: lo slot deve esistere ancora e avere posto (senza contare l'ordine stesso).
  if (oraRitiro && !orarioInvariato) {
    const gen = generaSlot({ adesso: new Date(), apertura: ordine.sede.orarioApertura, chiusura: ordine.sede.orarioChiusura });
    const scelto = [...gen.oggi, ...gen.domani].find((s) => new Date(s.iso).getTime() === oraRitiro!.getTime());
    if (!scelto) return NextResponse.json({ error: "L'orario scelto non è più disponibile, scegline un altro", esito: "chiuso" }, { status: 422 });
    const peso = esito.articoli.reduce(
      (acc, a) => acc + pesoRiga(a.categoria, a.taglia === "maxi" ? `${a.nomeSnapshot} (Maxi)` : a.nomeSnapshot, a.quantita),
      0
    );
    const [disp] = await disponibilitaSlot(ordine.sede, [scelto.iso], peso, ordine.id);
    if (disp?.pieno) return NextResponse.json({ error: "Quella fascia oraria è al completo, scegli un altro orario", esito: "cucina_piena" }, { status: 422 });
  }

  // Totali: la consegna resta quella dell'ordine; lo sconto fedeltà già applicato resta, ma non può superare i prodotti.
  const costoConsegna = parseFloat(ordine.costoConsegna.toString());
  const scontoPrecedente = parseFloat(ordine.scontoFedelta.toString());
  const scontoApplicato = Math.min(scontoPrecedente, esito.totale);
  const totale = Math.round((esito.totale + costoConsegna - scontoApplicato) * 100) / 100;

  // Orario. Il cliente manda l'orario scelto, oppure niente per «appena possibile».
  // - orario nuovo (o passato da «appena possibile» a un orario / viceversa): la pizzeria dovrà concordarlo di nuovo;
  // - orario invariato: resta quello già concordato.
  let datiOrario: { oraRichiesta?: Date; oraConsegnaComunicata?: null; modalitaConsegna?: null } = {};
  if (oraRitiro) {
    if (!orarioInvariato) datiOrario = { oraRichiesta: oraRitiro, oraConsegnaComunicata: null, modalitaConsegna: null };
  } else if (eraPrenotato) {
    datiOrario = { oraRichiesta: new Date(), oraConsegnaComunicata: null, modalitaConsegna: null };
  }

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
        totale,
        scontoFedelta: scontoApplicato,
        metodoPagamento,
        ...datiOrario,
        items: { deleteMany: {}, create: righeOrdineDaArticoli(esito.articoli) },
      },
    });
    await tx.ordineStatoLog.create({
      data: { ordineId: ordine.id, stato: "nuovo", note: `Modificato dal cliente (modifica ${ordine.modificheCliente + 1})` },
    });
    return true;
  });

  if (!fatto) return NextResponse.json({ error: "L'ordine è appena passato in preparazione: chiama la pizzeria" }, { status: 409 });

  return NextResponse.json({
    ok: true,
    numeroOrdine: ordine.numeroOrdine,
    sede: esito.sedeNome,
    totale,
    scontoFedelta: scontoApplicato,
    oraRitiro: oraRitiro ? oraRitiro.toISOString() : null,
  });
}
