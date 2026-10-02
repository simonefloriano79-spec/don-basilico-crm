import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clienteIdDaRichiesta } from "@/lib/customer-auth/session";
import { elaboraRichiestaOrdine, RichiestaOrdine } from "@/lib/ordini-vocali/orchestrazione";
import { ArticoloOrdinatoInput } from "@/lib/ordini-vocali/pricing";
import { generaSlot } from "@/lib/slot-ritiro";
import { disponibilitaSlot, pesoRiga } from "@/lib/capacita-pizze";
import { COSTO_CONSEGNA_DEFAULT } from "@/lib/consegna";

const METODI_PAGAMENTO = ["contanti", "carta"];

const lista = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

// POST /api/ordina/conferma — crea un ordine reale dal canale web cliente.
// Stessa orchestrazione (geocoding, zona, orario, prezzi) usata dall'agente
// vocale, con canale "online". L'ordine nasce in stato "nuovo" = DA ACCETTARE:
// la pizzeria lo accetta (eventualmente spostando l'orario) e solo allora il
// cliente riceve l'SMS di conferma. Nessun SMS parte da qui.
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
  if (tipo !== "asporto" && tipo !== "domicilio") {
    return NextResponse.json({ error: "Tipo di ordine non valido" }, { status: 400 });
  }
  const metodoPagamento = tipo === "domicilio" ? String(body.metodoPagamento ?? "") : null;

  if (tipo === "domicilio" && !METODI_PAGAMENTO.includes(metodoPagamento ?? "")) {
    return NextResponse.json({ error: "Scegli come pagare: contanti o carta" }, { status: 400 });
  }

  let oraRitiro: Date | undefined;
  if (body.oraRitiro) {
    oraRitiro = new Date(String(body.oraRitiro));
    if (Number.isNaN(oraRitiro.getTime())) {
      return NextResponse.json({ error: "Orario di ritiro non valido" }, { status: 400 });
    }
  }

  const articoli: ArticoloOrdinatoInput[] = (Array.isArray(body.articoli) ? body.articoli : []).map((a: any) => ({
    menuItemId: String(a?.menuItemId ?? ""),
    quantita: Number(a?.quantita) || 1,
    taglia: a?.taglia === "maxi" ? "maxi" : "normale",
    ingredientiAggiuntiIds: lista(a?.ingredientiAggiuntiIds),
    ingredientiRimossi: lista(a?.ingredientiRimossi),
    note: typeof a?.note === "string" && a.note.trim() ? a.note.trim().slice(0, 200) : undefined,
  }));

  if (!articoli.length) {
    return NextResponse.json({ error: "Il carrello è vuoto" }, { status: 400 });
  }

  const richiesta: RichiestaOrdine = {
    clienteNome: cliente.nome,
    clienteTelefono: cliente.telefono,
    tipo,
    clienteIndirizzo: body.clienteIndirizzo,
    sedeSlugAsporto: body.sedeSlugAsporto,
    articoli,
    note: body.note,
    oraRichiesta: oraRitiro?.toISOString(),
  };

  // Con un orario scelto, il controllo "sede aperta" riguarda quell'orario (non "adesso"):
  // si può prenotare di giorno per la sera, o a locale chiuso per il giorno dopo.
  const esito = await elaboraRichiestaOrdine(richiesta);
  if (!esito.ok) {
    return NextResponse.json({ error: esito.motivo, esito: esito.esito }, { status: 422 });
  }

  if (oraRitiro) {
    const sede = await prisma.sede.findUnique({ where: { id: esito.sedeId } });
    if (!sede) return NextResponse.json({ error: "Sede non trovata" }, { status: 404 });

    const gen = generaSlot({ adesso: new Date(), apertura: sede.orarioApertura, chiusura: sede.orarioChiusura });
    const scelto = [...gen.oggi, ...gen.domani].find((s) => new Date(s.iso).getTime() === oraRitiro!.getTime());
    if (!scelto) {
      return NextResponse.json({ error: "L'orario scelto non è più disponibile, scegline un altro", esito: "chiuso" }, { status: 422 });
    }

    const peso = esito.articoli.reduce(
      (acc, a) => acc + pesoRiga(a.categoria, a.taglia === "maxi" ? `${a.nomeSnapshot} (Maxi)` : a.nomeSnapshot, a.quantita),
      0
    );
    const [disp] = await disponibilitaSlot(sede, [scelto.iso], peso);
    if (disp?.pieno) {
      return NextResponse.json({ error: "Quella fascia oraria è al completo, scegli un altro orario", esito: "cucina_piena" }, { status: 422 });
    }
  }

  const indirizzoFinale = esito.indirizzoFormattato ?? richiesta.clienteIndirizzo ?? null;
  const costoConsegna = tipo === "domicilio" ? COSTO_CONSEGNA_DEFAULT : 0;
  const nomeCitofono =
    tipo === "domicilio" && typeof body.nomeCitofono === "string" && body.nomeCitofono.trim()
      ? body.nomeCitofono.trim().slice(0, 80)
      : null;
  const totale = Math.round((esito.totale + costoConsegna) * 100) / 100;

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
        nomeCitofono,
        note: richiesta.note ?? null,
        oraRichiesta: esito.oraRichiesta,
        totale,
        costoConsegna,
        metodoPagamento,
        items: {
          create: esito.articoli.map((a) => ({
            menuItemId: a.menuItemId,
            nomeSnapshot: a.taglia === "maxi" ? `${a.nomeSnapshot} (Maxi)` : a.nomeSnapshot,
            prezzoSnapshot: a.prezzoSnapshot,
            quantita: a.quantita,
            ingredientiRimossi: a.rimossi.map((r) => r.ingredienteId),
            noteItem:
              [
                a.rimossi.length ? `Senza: ${a.rimossi.map((r) => r.nome).join(", ")}` : "",
                a.extra.length ? `Con: ${a.extra.map((e) => e.nome).join(", ")}` : "",
                a.note ?? "",
              ]
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
    totale,
    costoConsegna,
    oraRitiro: oraRitiro ? oraRitiro.toISOString() : null,
  });
}
