import { NextRequest, NextResponse } from "next/server";
import { verificaSegretoWebhook } from "@/lib/ordini-vocali/auth";
import { elaboraRichiestaOrdine } from "@/lib/ordini-vocali/orchestrazione";
import { trovaClientePerTelefono } from "@/lib/ordini-vocali/cliente";
import { anteprimaSconti } from "@/lib/ordini-vocali/sconti";
import { RichiestaTelefonica, datiMancanti, senzaItalia, totaliTelefonici, validaDatiTelefonici } from "@/lib/ordini-vocali/telefono";

// POST /api/ordini-vocali/prepara
// Tool "preventivo": l'assistente lo chiama quando il cliente ha finito di
// ordinare. Calcola sede/totale/disponibilità reali SENZA salvare nulla, così
// l'assistente può dire "il totale è €X, confermi?" prima di impegnarsi.
// Il totale include la consegna (1,50 €) per il domicilio: è quello che poi salva «conferma».
export async function POST(req: NextRequest) {
  if (!verificaSegretoWebhook(req)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = (await req.json()) as RichiestaTelefonica;

  const incompleti = datiMancanti(body);
  if (incompleti) return NextResponse.json({ ok: false, esito: "errore", motivo: incompleti }, { status: 200 });

  const mancante = validaDatiTelefonici(body);
  if (mancante) return NextResponse.json({ ok: false, esito: "errore", motivo: mancante }, { status: 200 });

  const esito = await elaboraRichiestaOrdine(body);

  if (!esito.ok) {
    return NextResponse.json(esito, { status: 200 });
  }

  // Sconto fedeltà e codici come nell'app. Il cliente si riconosce dal telefono (anagrafica e tessera).
  const cliente = await trovaClientePerTelefono(body.clienteTelefono);
  const sconti = await anteprimaSconti({
    telefono: body.clienteTelefono,
    clienteId: cliente?.id ?? null,
    totaleProdotti: esito.totale,
    usaScontoFedelta: body.usaScontoFedelta === true,
    codiceSconto: body.codiceSconto,
  });
  if (!sconti.ok) return NextResponse.json({ ok: false, esito: "errore", motivo: sconti.motivo }, { status: 200 });

  const { totaleProdotti, costoConsegna, scontoFedelta, scontoCodice, totale } = totaliTelefonici(
    body.tipo, esito.totale, sconti.scontoFedelta, sconti.scontoCodice
  );

  return NextResponse.json({
    ok: true,
    sede: esito.sedeNome,
    totale,
    totaleProdotti,
    costoConsegna,
    scontoFedelta,
    scontoCodice,
    codiceSconto: sconti.codice,
    // Tessera fedeltà del cliente: se scontoDisponibile è vero offri lo sconto (si applica rimandando usaScontoFedelta=true);
    // se haTessera è falso puoi proporre di attivarla (attivaTessera=true solo dopo un sì esplicito).
    fedelta: sconti.fedelta,
    // Riepilogo da rileggere al cliente: una riga per articolo, con le modifiche.
    articoli: esito.articoli.map((a) => ({
      nome: a.nomeSnapshot,
      quantita: a.quantita,
      maxi: a.taglia === "maxi",
      prezzoUnitario: a.prezzoSnapshot,
      // Come si è formato il prezzo (aggiunte, ingredienti tolti, impasto): è QUESTO da dire al cliente se chiede.
      dettaglioPrezzo: a.dettaglioPrezzo ?? null,
      senza: a.rimossi.map((r) => r.nome),
      conExtra: a.extra.map((e) => e.nome),
      impasto: a.impasto?.nome ?? null,
      contenutoCombo: a.combo?.dettaglio ?? null,
      note: a.note,
    })),
    indirizzoConfermato: senzaItalia(esito.indirizzoFormattato),
  });
}
