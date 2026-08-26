import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clienteIdDaRichiesta } from "@/lib/customer-auth/session";
import { elaboraRichiestaOrdine, RichiestaOrdine } from "@/lib/ordini-vocali/orchestrazione";

const METODI_PAGAMENTO = ["contanti", "carta"];

// POST /api/ordina/conferma — crea un ordine reale dal canale web cliente.
// Stessa orchestrazione (geocoding, zona, orario, capacità, prezzi) usata
// dall'agente vocale in app/api/ordini-vocali/conferma, con canale "online"
// e il metodo di pagamento (rilevante solo per il domicilio: se contanti
// nessun problema, se carta il rider ha il POS). Nessuna modifica a
// Ordini/KDS/Dashboard/stampa: già gestiscono il canale "online".
export async function POST(req: NextRequest) {
  const clienteId = clienteIdDaRichiesta(req);
  if (!clienteId) {
    return NextResponse.json({ error: "Devi registrarti con il tuo numero di telefono per ordinare" }, { status: 401 });
  }

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente || !cliente.telefono) {
    return NextResponse.json({ error: "Sessione non valida, effettua di nuovo la registrazione" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const tipo = body.tipo as "asporto" | "domicilio";
  const metodoPagamento = tipo === "domicilio" ? String(body.metodoPagamento ?? "") : null;

  if (tipo === "domicilio" && !METODI_PAGAMENTO.includes(metodoPagamento ?? "")) {
    return NextResponse.json({ error: "Scegli come pagare: contanti o carta" }, { status: 400 });
  }

  const richiesta: RichiestaOrdine = {
    clienteNome: cliente.nome,
    clienteTelefono: cliente.telefono,
    tipo,
    clienteIndirizzo: body.clienteIndirizzo,
    sedeSlugAsporto: body.sedeSlugAsporto,
    articoli: body.articoli ?? [],
    note: body.note,
  };

  if (!richiesta.articoli?.length) {
    return NextResponse.json({ error: "Il carrello è vuoto" }, { status: 400 });
  }

  const esito = await elaboraRichiestaOrdine(richiesta);
  if (!esito.ok) {
    return NextResponse.json({ error: esito.motivo, esito: esito.esito }, { status: 422 });
  }

  const indirizzoFinale = esito.indirizzoFormattato ?? richiesta.clienteIndirizzo ?? null;

  const ordine = await prisma.$transaction(async (tx) => {
    const ordineCreato = await tx.ordine.create({
      data: {
        sedeId: esito.sedeId,
        canale: "online",
        tipo,
        stato: "nuovo",
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        clienteTelefono: cliente.telefono,
        clienteIndirizzo: indirizzoFinale,
        note: richiesta.note ?? null,
        totale: esito.totale,
        metodoPagamento,
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
      data: { ordineId: ordineCreato.id, stato: "nuovo" },
    });

    return ordineCreato;
  });

  return NextResponse.json({
    ok: true,
    numeroOrdine: ordine.numeroOrdine,
    sede: esito.sedeNome,
    totale: esito.totale,
  });
}
