import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificaSegretoWebhook } from "@/lib/ordini-vocali/auth";
import { CATEGORIE_MAXI, CATEGORIE_META_E_META, PREZZO_PEZZO_FRITTO, coloreDellaPizza, vendutoAPezzo } from "@/lib/ordini-vocali/pricing";
import { CATEGORIE_IMPASTO, impastiDellaSede } from "@/lib/impasti";
import { trovaCasistica } from "@/lib/ordini-vocali/casistiche";
import { cercaPerIngredienti } from "@/lib/ordini-vocali/ricerca-ingredienti";
import { bevandaAmmessaInCombo, comboDisponibileIn, leggiComboConfig } from "@/lib/combo";

const MAX_RISULTATI = 5;

// Tool per l'assistente vocale: risolve un nome detto dal cliente (prodotto o ingrediente extra) in id reali,
// con matching approssimativo (pg_trgm) per tollerare imprecisioni della trascrizione vocale.
// Con `sedeSlug` risponde come il menù di quella pizzeria: prodotti non disponibili esclusi, prezzi della sede,
// ingredienti spenti esclusi, maxi/impasti/combo solo se la sede li ha. Senza sede cerca su tutto il menù.
async function cerca(q: string, sedeSlug?: string | null) {
  const sede = sedeSlug ? await prisma.sede.findUnique({ where: { slug: sedeSlug } }) : null;
  if (sedeSlug && !sede) return NextResponse.json({ error: `Sede sconosciuta: ${sedeSlug}` }, { status: 400 });

  // Casistica nota della pizzeria («prosciutto e funghi» → «crudo o cotto?»): si cercano direttamente quelle pizze,
  // senza ricerca per nome né per ingredienti, così l'assistente non elenca nient'altro.
  const casistica = trovaCasistica(q);
  const uguale = (nome: string) => ({ nome: { equals: nome, mode: "insensitive" as const } });
  const [pizzeCasistica, extraCasistica] = casistica
    ? await Promise.all([
        prisma.menuItem.findMany({ where: { isAttivo: true, OR: casistica.opzioni.map((o) => uguale(o.pizza)) }, select: { id: true, nome: true } }),
        prisma.ingrediente.findMany({
          where: { OR: casistica.opzioni.flatMap((o) => o.conExtra).map(uguale) },
          select: { id: true, nome: true, prezzoAggiunta: true },
        }),
      ])
    : [[], []];

  const [rankProdotti, rankIngredienti] = await Promise.all([
    casistica
      ? Promise.resolve([] as { id: string; punteggio: number }[])
      : prisma.$queryRaw<{ id: string; punteggio: number }[]>`
      SELECT id, similarity(nome, ${q})::float8 AS punteggio FROM menu_items
      WHERE is_attivo = true AND (similarity(nome, ${q}) > 0.2 OR word_similarity(${q}, nome) > 0.45)
      ORDER BY (lower(nome) = lower(${q})) DESC,
               GREATEST(similarity(nome, ${q}), word_similarity(${q}, nome)) DESC,
               similarity(nome, ${q}) DESC
      LIMIT 12
    `,
    casistica
      ? Promise.resolve([] as { id: string }[])
      : prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM ingredienti
      WHERE similarity(nome, ${q}) > 0.2 OR word_similarity(${q}, nome) > 0.45
      ORDER BY GREATEST(similarity(nome, ${q}), word_similarity(${q}, nome)) DESC
      LIMIT 12
    `,
  ]);
  // Ricerca per INGREDIENTI («patate e salsiccia» → Campagnola): le pizze che li contengono tutti vanno in testa;
  // quelle che ne hanno solo qualcuno restano dopo i risultati per nome.
  const perIngredienti = casistica ? { coprono: [], parziali: [] } : await cercaPerIngredienti(q);
  const trovatiPerIngredienti = new Map([...perIngredienti.parziali, ...perIngredienti.coprono].map((x) => [x.id, x.ingredientiTrovati]));
  // Se il cliente dice il NOME esatto di una pizza («cotto e funghi»), quella viene per prima: la ricerca per
  // ingredienti serve solo quando non ha detto un nome.
  const nomeEsatto = rankProdotti.filter((r) => r.punteggio >= 0.9).map((r) => r.id);
  const idProdotti = casistica
    ? casistica.opzioni.map((o) => pizzeCasistica.find((p) => p.nome.toLowerCase() === o.pizza.toLowerCase())?.id).filter((id): id is string => !!id)
    : Array.from(new Set([
    ...nomeEsatto,
    ...perIngredienti.coprono.map((x) => x.id),
    ...rankProdotti.map((r) => r.id),
    ...perIngredienti.parziali.map((x) => x.id),
  ])).slice(0, 25);
  const idIngredienti = rankIngredienti.map((r) => r.id);

  const [prodottiDb, ingredientiDb, overrides, maxi, disabilitati] = await Promise.all([
    idProdotti.length
      ? prisma.menuItem.findMany({
          where: { id: { in: idProdotti }, isAttivo: true },
          include: { ingredienti: { include: { ingrediente: { select: { id: true, nome: true } } } } },
        })
      : [],
    idIngredienti.length ? prisma.ingrediente.findMany({ where: { id: { in: idIngredienti } } }) : [],
    sede ? prisma.sedeMenuOverride.findMany({ where: { sedeId: sede.id } }) : [],
    sede ? prisma.sedePizzaMaxi.findUnique({ where: { sedeId: sede.id } }) : null,
    sede ? prisma.sedeIngredienteDisabilitato.findMany({ where: { sedeId: sede.id } }) : [],
  ]);

  const overrideMap = new Map(overrides.map((o) => [o.menuItemId, o]));
  const ingDisabilitati = new Set(disabilitati.map((d) => d.ingredienteId));
  const moltiplicatore = maxi?.attiva ? parseFloat(maxi.moltiplicatore.toString()) : null;

  const perRilevanza = <T extends { id: string }>(righe: T[], ordine: string[]) =>
    [...righe].sort((a, b) => ordine.indexOf(a.id) - ordine.indexOf(b.id));

  const prodotti = perRilevanza(prodottiDb, idProdotti)
    .filter((p) => overrideMap.get(p.id)?.disponibile !== false)
    .slice(0, MAX_RISULTATI);

  // Combo: servono i prodotti della sede per dire cosa contiene e tra cosa si può scegliere.
  let disponibiliInSede: { id: string; nome: string; categoria: string }[] = [];
  if (prodotti.some((p) => p.categoria === "combo")) {
    const tutti = await prisma.menuItem.findMany({ where: { isAttivo: true }, select: { id: true, nome: true, categoria: true } });
    disponibiliInSede = tutti.filter((m) => overrideMap.get(m.id)?.disponibile !== false);
  }

  const casisticaDelProdotto = (nome: string) => {
    const o = casistica?.opzioni.find((x) => x.pizza.toLowerCase() === nome.toLowerCase());
    if (!casistica || !o) return {};
    const extra = o.conExtra
      .map((n) => extraCasistica.find((e) => e.nome.toLowerCase() === n.toLowerCase()))
      .filter((e): e is NonNullable<typeof e> => !!e && !ingDisabilitati.has(e.id))
      .map((e) => ({ ingredienteId: e.id, nome: e.nome, prezzoAggiunta: parseFloat(e.prezzoAggiunta.toString()) }));
    // Se un ingrediente da aggiungere non è disponibile in questa pizzeria, l'opzione non va offerta.
    return {
      ...(casistica.chiedi ? { rispostaCasistica: o.risposta } : { casisticaPizzeria: true }),
      ...(o.conExtra.length ? { extraDaAggiungere: extra } : {}),
      ...(extra.length < o.conExtra.length ? { opzioneNonDisponibile: true } : {}),
    };
  };

  const risposteProdotti = prodotti.map((p) => {
    const override = overrideMap.get(p.id);
    const prezzo = parseFloat((override?.prezzoCustom ?? p.prezzoBase).toString());
    const base = {
      menuItemId: p.id,
      nome: p.nome,
      categoria: p.categoria,
      descrizione: p.descrizione,
      prezzo,
      // Se la pizza è stata trovata dagli ingredienti detti dal cliente e non dal nome, lo dice: l'assistente
      // la PROPONE («Campagnola, con patate alla brace e salsiccia: va bene?») invece di darla per scontata.
      // Casistica nota: o la pizza è quella (l'assistente la prende senza chiedere né elencare alternative),
      // oppure c'è UNA domanda da fare (casisticaDomanda in cima) e ogni pizza dice a quale risposta corrisponde.
      ...casisticaDelProdotto(p.nome),
      ...(trovatiPerIngredienti.has(p.id) ? { trovataPerIngredienti: trovatiPerIngredienti.get(p.id) } : {}),
    };

    if (p.categoria === "combo") {
      const cfg = leggiComboConfig(p.comboConfig);
      if (!cfg || !comboDisponibileIn(p, disponibiliInSede)) return { ...base, combo: { disponibile: false } };
      const nomeDi = (id: string) => disponibiliInSede.find((m) => m.id === id)?.nome ?? "";
      return {
        ...base,
        combo: {
          disponibile: true,
          contiene: cfg.componenti.flatMap((c) => Array<string>(c.qta).fill(nomeDi(c.id))),
          bibiteDaScegliere: cfg.bibite,
          pizzeSpecialiDaScegliere: cfg.pizzeSpeciali,
          bibiteAmmesse: disponibiliInSede
            .filter((m) => m.categoria === "bevande" && bevandaAmmessaInCombo(m.nome))
            .map((m) => ({ menuItemId: m.id, nome: m.nome })),
          pizzeSpecialiAmmesse: disponibiliInSede
            .filter((m) => m.categoria === "menu_speciale")
            .map((m) => ({ menuItemId: m.id, nome: m.nome })),
        },
      };
    }

    return {
      ...base,
      // Ingredienti di base: servono per i «senza» (si passa l'ingredienteId in ingredientiRimossi).
      ingredienti: p.ingredienti.map((i) => ({ ingredienteId: i.ingrediente.id, nome: i.ingrediente.nome })),
      maxi: moltiplicatore && CATEGORIE_MAXI.has(p.categoria) ? { prezzo: Math.round(prezzo * moltiplicatore * 100) / 100 } : null,
      impastoSpeciale: CATEGORIE_IMPASTO.has(p.categoria),
      // Crocchette e supplì si vendono anche a pezzo: se il cliente dice un numero senza «porzioni» (es. «3 crocchette»)
      // chiedi «3 porzioni o 3 di numero?» e con «di numero» usa aPezzo=true (quantita = pezzi, prezzo per pezzo).
      ...(vendutoAPezzo(p)
        ? { venduto: { porzione: Math.round(prezzo * 100) / 100, pezzo: PREZZO_PEZZO_FRITTO, domanda: "Porzioni intere o pezzi singoli?" } }
        : {}),
      // «Metà e metà» (si paga la pizza che costa di più): solo tra pizze dello stesso colore, o tutta bianca o tutta rossa.
      ...(CATEGORIE_META_E_META.has(p.categoria) ? { colore: coloreDellaPizza(p) } : {}),
    };
  });

  // Impasti speciali della sede, una volta sola e solo se tra i risultati c'è una pizza che li accetta.
  const impasti =
    sede && prodotti.some((p) => CATEGORIE_IMPASTO.has(p.categoria))
      ? (await impastiDellaSede(sede.id)).map((i) => ({ impastoId: i.id, nome: i.nome, supplemento: i.supplemento }))
      : undefined;

  const ingredientiExtra = perRilevanza(ingredientiDb, idIngredienti)
    .filter((i) => !ingDisabilitati.has(i.id))
    .slice(0, MAX_RISULTATI)
    .map((i) => ({ ingredienteId: i.id, nome: i.nome, prezzoAggiunta: parseFloat(i.prezzoAggiunta.toString()) }));

  return NextResponse.json({
    sede: sede?.nome ?? null,
    ...(casistica?.chiedi ? { casisticaDomanda: casistica.chiedi } : {}),
    prodotti: risposteProdotti,
    ingredientiExtra,
    ...(impasti ? { impasti } : {}),
  });
}

// GET /api/ordini-vocali/cerca-menu?q=diavola&sedeSlug=centro
export async function GET(req: NextRequest) {
  if (!verificaSegretoWebhook(req)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Parametro q richiesto" }, { status: 400 });
  return cerca(q, req.nextUrl.searchParams.get("sedeSlug"));
}

// POST /api/ordini-vocali/cerca-menu  { query, sedeSlug }  — stessa cosa, per le piattaforme che mandano i tool in JSON.
export async function POST(req: NextRequest) {
  if (!verificaSegretoWebhook(req)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const q = String(body.query ?? body.q ?? "").trim();
  if (!q) return NextResponse.json({ error: "Parametro query richiesto" }, { status: 400 });
  return cerca(q, typeof body.sedeSlug === "string" ? body.sedeSlug : null);
}
