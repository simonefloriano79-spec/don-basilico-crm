import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { statoTessera, TIMBRI_PER_CICLO } from "@/lib/fedelta";
import { verificaSegretoWebhook } from "@/lib/ordini-vocali/auth";
import { trovaClientePerTelefono } from "@/lib/ordini-vocali/cliente";
import { trovaOrdineAperto } from "@/lib/ordini-vocali/ordine-aperto";
import { geocodificaIndirizzo, trovaSedeCompetente } from "@/lib/ordini-vocali/copertura";
import { senzaItalia } from "@/lib/ordini-vocali/telefono";

const euro = (n: number) => n.toFixed(2).replace(".", ",");

// Indirizzo abituale: l'ultimo di consegna usato, controllato di nuovo contro le zone (le zone possono cambiare);
// il risultato dice anche quale pizzeria lo serve, così l'assistente può saltare `verifica_indirizzo`.
async function indirizzoAbituale(indirizzo: string) {
  try {
    const geo = await geocodificaIndirizzo(indirizzo, { richiediVia: true });
    if (!geo) return { indirizzo, coperto: false as const };
    const sede = await trovaSedeCompetente(geo.lat, geo.lng);
    if (!sede) return { indirizzo: senzaItalia(geo.indirizzoFormattato) ?? indirizzo, coperto: false as const };
    const dettagli = await prisma.sede.findUnique({ where: { id: sede.sedeId }, select: { slug: true } });
    return { indirizzo: senzaItalia(geo.indirizzoFormattato) ?? indirizzo, coperto: true as const, sedeSlug: dettagli?.slug, sedeNome: sede.nome };
  } catch (e) {
    console.error("riconosci-cliente: controllo indirizzo abituale fallito", e);
    return { indirizzo, coperto: null };
  }
}

async function riconosci(telefonoGrezzo: string) {
  const telefono = telefonoGrezzo.trim();
  const sconosciuto = {
    ok: true,
    riconosciuto: false,
    variabili: { cliente_riconosciuto: "no", nome_cliente: "", indirizzo_abituale: "", sede_abituale: "", ultimo_ordine: "", sconto_fedelta: "" },
  };
  if (!telefono) return NextResponse.json(sconosciuto);

  const cliente = await trovaClientePerTelefono(telefono);
  if (!cliente) {
    // Nessuna anagrafica, ma la tessera fedeltà può esistere lo stesso (creata altrove con questo numero).
    const tessera = await statoTessera(telefono);
    return NextResponse.json({
      ...sconosciuto,
      fedelta: tessera ? fedelta(tessera) : { haTessera: false, timbri: 0, timbriPerCiclo: TIMBRI_PER_CICLO, scontoDisponibile: false, importoSconto: 0 },
    });
  }

  const [ordini, tessera, ordineAperto] = await Promise.all([
    prisma.ordine.findMany({
      where: { clienteId: cliente.id, stato: { not: "annullato" } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        numeroOrdine: true, createdAt: true, tipo: true, clienteIndirizzo: true, nomeCitofono: true, metodoPagamento: true,
        sede: { select: { slug: true, nome: true } },
        items: {
          select: {
            menuItemId: true, nomeSnapshot: true, quantita: true, ingredientiRimossi: true, ingredientiAggiunti: true,
            impastoId: true, comboScelte: true, notaCliente: true,
          },
        },
      },
    }),
    statoTessera(telefono),
    trovaOrdineAperto(telefono),
  ]);

  const ultimo = ordini[0] ?? null;
  const ultimoDomicilio = ordini.find((o) => o.tipo === "domicilio" && o.clienteIndirizzo) ?? null;
  const testoIndirizzo = ultimoDomicilio?.clienteIndirizzo ?? cliente.indirizzoDefault ?? null;
  const abituale = testoIndirizzo ? await indirizzoAbituale(testoIndirizzo) : null;
  const giorniFa = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86400000);
  const riga = (i: { quantita: number; nomeSnapshot: string }) => `${i.quantita}x ${i.nomeSnapshot}`;
  const stato = tessera ? fedelta(tessera) : { haTessera: false, timbri: 0, timbriPerCiclo: TIMBRI_PER_CICLO, scontoDisponibile: false, importoSconto: 0 };

  return NextResponse.json({
    ok: true,
    riconosciuto: true,
    nome: cliente.nome,
    // Ordini precedenti, solo riepilogo.
    ultimiOrdini: ordini.map((o) => ({
      numeroOrdine: o.numeroOrdine,
      giorniFa: giorniFa(o.createdAt),
      tipo: o.tipo,
      sede: o.sede.nome,
      righe: o.items.map(riga),
    })),
    // Ultimo ordine in forma pronta per `prepara_ordine` («stesso ordine dell'ultima volta?»): prezzi e disponibilità
    // sono comunque ricalcolati da `prepara_ordine`, e se un prodotto non c'è più lo dice.
    ultimoOrdine: ultimo && {
      tipo: ultimo.tipo,
      sedeSlug: ultimo.sede.slug,
      nomeCitofono: ultimo.nomeCitofono,
      metodoPagamento: ultimo.metodoPagamento,
      articoli: ultimo.items
        .filter((i) => i.menuItemId)
        .map((i) => ({
          menuItemId: i.menuItemId,
          nome: i.nomeSnapshot,
          quantita: i.quantita,
          taglia: /\(maxi\)/i.test(i.nomeSnapshot) ? "maxi" : "normale",
          ingredientiRimossi: i.ingredientiRimossi,
          ingredientiAggiuntiIds: i.ingredientiAggiunti,
          impastoId: i.impastoId,
          comboScelte: i.comboScelte,
          note: i.notaCliente,
        })),
    },
    // Ordine fatto da poco che il cliente può ancora cambiare o annullare (stesse regole dell'app). Se il cliente dice
    // «ho appena ordinato, devo cambiare/aggiungere…» si usa questo, con lo strumento di modifica.
    ...(ordineAperto ? { ordineAperto } : {}),
    indirizzoAbituale: abituale && { ...abituale, nomeCitofono: ultimoDomicilio?.nomeCitofono ?? null },
    fedelta: stato,
    // Stesse informazioni in forma piatta, per le piattaforme che iniettano «variabili dinamiche» nel prompt prima del saluto.
    variabili: {
      cliente_riconosciuto: "si",
      nome_cliente: cliente.nome,
      indirizzo_abituale: abituale?.indirizzo ?? "",
      sede_abituale: (abituale && "sedeNome" in abituale ? abituale.sedeNome : ultimo?.sede.nome) ?? "",
      ultimo_ordine: ultimo ? ultimo.items.map(riga).join(", ") : "",
      sconto_fedelta: stato.scontoDisponibile ? euro(stato.importoSconto) : "",
    },
  });
}

function fedelta(s: { timbri: number; scontoDisponibile: boolean; importoSconto: number }) {
  return {
    haTessera: true,
    timbri: s.timbri,
    timbriPerCiclo: TIMBRI_PER_CICLO,
    scontoDisponibile: s.scontoDisponibile,
    importoSconto: s.importoSconto,
  };
}

// POST /api/ordini-vocali/riconosci-cliente  { telefono }
// Da chiamare all'inizio della chiamata con il numero chiamante: se il cliente è in anagrafica l'assistente lo saluta
// per nome, propone l'indirizzo abituale e l'ultimo ordine, e sa se ha uno sconto fedeltà da offrire.
export async function POST(req: NextRequest) {
  if (!verificaSegretoWebhook(req)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  return riconosci(String(body.telefono ?? ""));
}

// GET /api/ordini-vocali/riconosci-cliente?telefono=+39333...
export async function GET(req: NextRequest) {
  if (!verificaSegretoWebhook(req)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  return riconosci(req.nextUrl.searchParams.get("telefono") ?? "");
}
