import { NextRequest, NextResponse } from "next/server";
import { verificaSegretoWebhook } from "@/lib/ordini-vocali/auth";
import { elaboraRichiestaOrdine, RichiestaOrdine } from "@/lib/ordini-vocali/orchestrazione";

// POST /api/ordini-vocali/prepara
// Tool "preventivo": l'assistente lo chiama quando il cliente ha finito di
// ordinare. Calcola sede/totale/disponibilità reali SENZA salvare nulla, così
// l'assistente può dire "il totale è €X, confermi?" prima di impegnarsi.
export async function POST(req: NextRequest) {
  if (!verificaSegretoWebhook(req)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = (await req.json()) as RichiestaOrdine;

  if (!body.clienteNome || !body.clienteTelefono || !body.tipo || !body.articoli?.length) {
    return NextResponse.json({ ok: false, esito: "errore", motivo: "Dati ordine incompleti" }, { status: 400 });
  }

  const esito = await elaboraRichiestaOrdine(body);

  if (!esito.ok) {
    return NextResponse.json(esito, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    sede: esito.sedeNome,
    totale: esito.totale,
    articoli: esito.articoli,
    indirizzoConfermato: esito.indirizzoFormattato ?? null,
  });
}
