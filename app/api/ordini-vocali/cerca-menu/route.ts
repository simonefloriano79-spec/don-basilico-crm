import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificaSegretoWebhook } from "@/lib/ordini-vocali/auth";
import { CATEGORIE_MAXI } from "@/lib/ordini-vocali/pricing";
import { CATEGORIE_IMPASTO, impastiDellaSede } from "@/lib/impasti";
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

  const [rankProdotti, rankIngredienti] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM menu_items
      WHERE is_attivo = true AND (similarity(nome, ${q}) > 0.2 OR word_similarity(${q}, nome) > 0.45)
      ORDER BY GREATEST(similarity(nome, ${q}), word_similarity(${q}, nome)) DESC
      LIMIT 12
    `,
    prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM ingredienti
      WHERE similarity(nome, ${q}) > 0.2 OR word_similarity(${q}, nome) > 0.45
      ORDER BY GREATEST(similarity(nome, ${q}), word_similarity(${q}, nome)) DESC
      LIMIT 12
    `,
  ]);
  // Ricerca per INGREDIENTI («patate e salsiccia» → Campagnola): le pizze che li contengono tutti vanno in testa;
  // quelle che ne hanno solo qualcuno restano dopo i risultati per nome.
  const perIngredienti = await cercaPerIngredienti(q);
  const trovatiPerIngredienti = new Map([...perIngredienti.parziali, ...perIngredienti.coprono].map((x) => [x.id, x.ingredientiTrovati]));
  const idProdotti = Array.from(new Set([
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
