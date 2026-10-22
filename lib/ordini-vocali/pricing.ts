import { prisma } from "@/lib/prisma";
import { CATEGORIE_IMPASTO, impastiDellaSede } from "@/lib/impasti";
import { bevandaAmmessaInCombo, leggiComboConfig, leggiComboScelte, testoDettaglioCombo, type ComboScelte } from "@/lib/combo";

// Pizza maxi: rosse, bianche, speciali e focacce (non i calzoni), e solo nelle sedi con la maxi attiva (tabella sedi_pizza_maxi).
export const CATEGORIE_MAXI = new Set(["pizze_rosse", "pizze_bianche", "menu_speciale", "focacce"]);

// «Metà e metà»: solo tra pizze, e le due metà devono essere dello stesso colore (o tutta bianca o tutta rossa).
export const CATEGORIE_META_E_META = new Set(["pizze_rosse", "pizze_bianche", "menu_speciale"]);

// Rossa = con pomodoro. Per le categorie «rosse»/«bianche» vale la categoria; per le speciali gli ingredienti.
export function coloreDellaPizza(m: { categoria: string; ingredienti: { ingrediente: { nome: string } }[] }): "rossa" | "bianca" {
  if (m.categoria === "pizze_rosse") return "rossa";
  if (m.categoria === "pizze_bianche") return "bianca";
  return m.ingredienti.some((i) => /pomodoro|passata/i.test(i.ingrediente.nome)) ? "rossa" : "bianca";
}

export interface ArticoloOrdinatoInput {
  menuItemId: string;
  quantita: number;
  taglia?: "normale" | "maxi";
  ingredientiAggiuntiIds?: string[];
  ingredientiRimossi?: string[];
  impastoId?: string;
  /** «Metà e metà»: menuItemId della seconda metà (la prima è menuItemId). Si paga la pizza che costa di più. */
  secondaMeta?: string;
  note?: string;
  /** Solo per i «Menù Combo»: bibite e pizze speciali scelte (id dei prodotti). */
  comboScelte?: { bibite?: string[]; pizze?: string[] };
}

export interface ArticoloPrezzato {
  menuItemId: string;
  nomeSnapshot: string;
  categoria: string;
  taglia: "normale" | "maxi";
  prezzoSnapshot: number;
  quantita: number;
  extra: { ingredienteId: string; nome: string; prezzo: number }[];
  rimossi: { ingredienteId: string; nome: string }[];
  impasto: { id: string; nome: string; supplemento: number } | null;
  /** Come si è formato il prezzo quando ci sono aggiunte, ingredienti tolti o impasto: da dire al cliente, mai da calcolare a mente. */
  dettaglioPrezzo?: string | null;
  /** «Metà e metà»: id della seconda pizza (la prima è menuItemId). */
  secondaMetaId?: string | null;
  note: string | null;
  /** Solo per i combo: scelte validate, testo per la comanda e quante pizze contano per la cucina. */
  combo: { scelte: ComboScelte; dettaglio: string; pizze: number } | null;
}

export class ErrorePricing extends Error {}

// Calcola il totale reale di un ordine lato server: non fidarsi mai del
// prezzo che arriva dal client o dall'assistente vocale.
//
// Regole (identiche alla cassa, app/api/ordini/route.ts):
// - prezzo di partenza = prezzo personalizzato della sede, se c'è, altrimenti prezzo base;
// - togliere un ingrediente non genera mai sconto da solo; "copre" fino al suo
//   valore gli extra aggiunti: extra = max(0, aggiunti - credito dei rimossi);
// - gli ingredienti con escludiCompensazione (es. mozzarella, pomodoro) non danno credito.
export async function calcolaOrdine(
  sedeId: string,
  articoli: ArticoloOrdinatoInput[],
  canale?: "online"
): Promise<{ articoli: ArticoloPrezzato[]; totale: number }> {
  if (!articoli.length) throw new ErrorePricing("Nessun articolo nell'ordine");

  const menuItemIds = Array.from(new Set(articoli.flatMap((a) => [a.menuItemId, a.secondaMeta].filter((x): x is string => !!x))));
  const ingredienteIds = Array.from(
    new Set(articoli.flatMap((a) => [...(a.ingredientiAggiuntiIds ?? []), ...(a.ingredientiRimossi ?? [])]))
  );

  const impastiSede = articoli.some((a) => a.impastoId) ? await impastiDellaSede(sedeId) : [];
  const impastoMap = new Map(impastiSede.map((i) => [i.id, i]));

  const [menuItems, ingredienti, maxiConfig, overrides, disabilitati] = await Promise.all([
    prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, isAttivo: true },
      include: { ingredienti: { select: { ingredienteId: true, ingrediente: { select: { nome: true } } } } },
    }),
    ingredienteIds.length
      ? prisma.ingrediente.findMany({ where: { id: { in: ingredienteIds } } })
      : Promise.resolve([]),
    prisma.sedePizzaMaxi.findUnique({ where: { sedeId } }),
    prisma.sedeMenuOverride.findMany({ where: { sedeId, menuItemId: { in: menuItemIds } } }),
    prisma.sedeIngredienteDisabilitato.findMany({ where: { sedeId } }),
  ]);

  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));
  const ingredienteMap = new Map(ingredienti.map((i) => [i.id, i]));
  const overrideMap = new Map(overrides.map((o) => [o.menuItemId, o]));
  const ingDisabilitati = new Set(disabilitati.map((d) => d.ingredienteId));
  const maxiDisponibile = !!maxiConfig?.attiva;
  const moltiplicatore = maxiConfig ? parseFloat(maxiConfig.moltiplicatore.toString()) : 1;

  // Combo: servono nomi, categorie e disponibilità in sede dei prodotti contenuti e di quelli scelti.
  const idCombo = new Set(menuItems.filter((m) => m.categoria === "combo").map((m) => m.id));
  const idCollegati = new Set<string>();
  menuItems.filter((m) => idCombo.has(m.id)).forEach((m) => leggiComboConfig(m.comboConfig)?.componenti.forEach((c) => idCollegati.add(c.id)));
  articoli.filter((a) => idCombo.has(a.menuItemId)).forEach((a) => {
    const sc = leggiComboScelte(a.comboScelte);
    [...sc.bibite, ...sc.pizze].forEach((id) => idCollegati.add(id));
  });
  const [itemCollegati, overrideCollegati] = idCollegati.size
    ? await Promise.all([
        prisma.menuItem.findMany({ where: { id: { in: Array.from(idCollegati) } }, select: { id: true, nome: true, categoria: true, isAttivo: true } }),
        prisma.sedeMenuOverride.findMany({ where: { sedeId, menuItemId: { in: Array.from(idCollegati) } } }),
      ])
    : [[], []];
  const collegatiMap = new Map(itemCollegati.map((i) => [i.id, i]));
  const nonDisponibiliInSede = new Set(overrideCollegati.filter((o) => o.disponibile === false).map((o) => o.menuItemId));

  let totale = 0;
  const articoliPrezzati: ArticoloPrezzato[] = articoli.map((a) => {
    const menuItem = menuItemMap.get(a.menuItemId);
    if (!menuItem) throw new ErrorePricing(`Prodotto non trovato o non disponibile: ${a.menuItemId}`);

    const override = overrideMap.get(menuItem.id);
    if (override && override.disponibile === false) {
      throw new ErrorePricing(`${menuItem.nome} non è disponibile in questa sede`);
    }

    // «Menù Combo»: prezzo fisso; si controllano le scelte (quante, e che siano ammesse e disponibili in questa sede).
    if (menuItem.categoria === "combo") {
      const cfg = leggiComboConfig(menuItem.comboConfig);
      if (!cfg) throw new ErrorePricing(`${menuItem.nome}: combo non configurato`);
      const sc = leggiComboScelte(a.comboScelte);
      if (sc.bibite.length !== cfg.bibite) throw new ErrorePricing(`${menuItem.nome}: scegli ${cfg.bibite} ${cfg.bibite === 1 ? "bibita" : "bibite"}`);
      if (sc.pizze.length !== cfg.pizzeSpeciali) throw new ErrorePricing(`${menuItem.nome}: scegli ${cfg.pizzeSpeciali} pizze speciali`);
      const nomeScelta = (id: string, ammessa: (i: { nome: string; categoria: string }) => boolean, cosa: string) => {
        const it = collegatiMap.get(id);
        if (!it || !it.isAttivo || !ammessa(it)) throw new ErrorePricing(`${menuItem.nome}: ${cosa} non valida`);
        if (nonDisponibiliInSede.has(id)) throw new ErrorePricing(`${it.nome} non è disponibile in questa sede`);
        return it.nome;
      };
      const nomiBibite = sc.bibite.map((id) => nomeScelta(id, (i) => i.categoria === "bevande" && bevandaAmmessaInCombo(i.nome), "la bibita scelta"));
      const nomiPizze = sc.pizze.map((id) => nomeScelta(id, (i) => i.categoria === "menu_speciale", "la pizza scelta"));
      const nomiFissi = cfg.componenti.flatMap((c) => {
        const it = collegatiMap.get(c.id);
        if (!it || !it.isAttivo || nonDisponibiliInSede.has(c.id)) throw new ErrorePricing(`${menuItem.nome} non è disponibile: ${it?.nome ?? "un prodotto"} manca in questa sede`);
        return Array<string>(c.qta).fill(it.nome);
      });
      const prezzoCombo = override?.prezzoCustom ? parseFloat(override.prezzoCustom.toString()) : parseFloat(menuItem.prezzoBase.toString());
      const quantitaCombo = Math.max(1, Math.round(a.quantita) || 1);
      totale += prezzoCombo * quantitaCombo;
      return {
        menuItemId: menuItem.id,
        nomeSnapshot: menuItem.nome,
        categoria: menuItem.categoria,
        taglia: "normale" as const,
        prezzoSnapshot: Math.round(prezzoCombo * 100) / 100,
        quantita: quantitaCombo,
        extra: [],
        rimossi: [],
        impasto: null,
        note: a.note ?? null,
        combo: { scelte: sc, dettaglio: testoDettaglioCombo(nomiFissi, { bibite: nomiBibite, pizze: nomiPizze }), pizze: cfg.pizze },
      };
    }

    const taglia: "normale" | "maxi" = a.taglia === "maxi" ? "maxi" : "normale";
    if (taglia === "maxi") {
      if (!CATEGORIE_MAXI.has(menuItem.categoria)) {
        throw new ErrorePricing(`${menuItem.nome} non è disponibile in formato maxi`);
      }
      if (!maxiDisponibile) {
        throw new ErrorePricing(`La pizza maxi non è disponibile in questa sede`);
      }
    }

    // Prezzo: quello personalizzato della sede, altrimenti (per l'app online) il «prezzo app» se c'è, altrimenti il prezzo base.
    const prezzoDi = (m: typeof menuItem, o: typeof override) =>
      o?.prezzoCustom
        ? parseFloat(o.prezzoCustom.toString())
        : canale === "online" && m.prezzoOnline != null
          ? parseFloat(m.prezzoOnline.toString())
          : parseFloat(m.prezzoBase.toString());

    // «Metà e metà»: due pizze dello stesso colore, si paga quella che costa di più.
    let altraMeta: typeof menuItem | null = null;
    if (a.secondaMeta && a.secondaMeta !== a.menuItemId) {
      altraMeta = menuItemMap.get(a.secondaMeta) ?? null;
      if (!altraMeta) throw new ErrorePricing(`Prodotto non trovato o non disponibile: ${a.secondaMeta}`);
      if (overrideMap.get(altraMeta.id)?.disponibile === false) throw new ErrorePricing(`${altraMeta.nome} non è disponibile in questa sede`);
      if (!CATEGORIE_META_E_META.has(menuItem.categoria) || !CATEGORIE_META_E_META.has(altraMeta.categoria)) {
        throw new ErrorePricing("Metà e metà si può fare solo tra due pizze");
      }
      if (coloreDellaPizza(menuItem) !== coloreDellaPizza(altraMeta)) {
        throw new ErrorePricing(
          `Metà e metà non si può fare tra una pizza bianca e una rossa (${menuItem.nome} è ${coloreDellaPizza(menuItem)}, ${altraMeta.nome} è ${coloreDellaPizza(altraMeta)}): o tutta bianca o tutta rossa`
        );
      }
    }
    const prezzoListino = altraMeta
      ? Math.max(prezzoDi(menuItem, override), prezzoDi(altraMeta, overrideMap.get(altraMeta.id)))
      : prezzoDi(menuItem, override);
    const prezzoBase = prezzoListino * (taglia === "maxi" ? moltiplicatore : 1);

    const extra = (a.ingredientiAggiuntiIds ?? []).map((id) => {
      const ing = ingredienteMap.get(id);
      if (!ing) throw new ErrorePricing(`Ingrediente non trovato: ${id}`);
      if (ingDisabilitati.has(id)) throw new ErrorePricing(`${ing.nome} non è disponibile in questa sede`);
      return { ingredienteId: id, nome: ing.nome, prezzo: parseFloat(ing.prezzoAggiunta.toString()) };
    });

    const baseIds = new Set([...menuItem.ingredienti, ...(altraMeta?.ingredienti ?? [])].map((i) => i.ingredienteId));
    const rimossiDefinitivi = Array.from(new Set(a.ingredientiRimossi ?? []));
    const rimossi = rimossiDefinitivi.map((id) => {
      const ing = ingredienteMap.get(id);
      if (!ing || !baseIds.has(id)) throw new ErrorePricing(`Ingrediente non rimovibile da ${menuItem.nome}`);
      return { ingredienteId: id, nome: ing.nome, credito: ing.escludiCompensazione ? 0 : parseFloat(ing.prezzoAggiunta.toString()) };
    });

    // Impasto speciale: solo se la pizzeria lo prepara e solo su pizze; il supplemento si somma al prezzo.
    let impasto: { id: string; nome: string; supplemento: number } | null = null;
    if (a.impastoId) {
      const imp = impastoMap.get(a.impastoId);
      if (!imp) throw new ErrorePricing("L'impasto scelto non è disponibile in questa pizzeria");
      if (!CATEGORIE_IMPASTO.has(menuItem.categoria)) throw new ErrorePricing(`${menuItem.nome}: l'impasto speciale non è disponibile`);
      impasto = { id: imp.id, nome: imp.nome, supplemento: imp.supplemento };
    }

    const extraLordo = extra.reduce((acc, e) => acc + e.prezzo, 0);
    const credito = rimossi.reduce((acc, r) => acc + r.credito, 0);
    const euroT = (n: number) => `${n.toFixed(2).replace(".", ",")} euro`;
    // Maxi: anche gli extra (e il credito degli ingredienti tolti) valgono il doppio; il supplemento dell'impasto no.
    const fattoreMaxi = taglia === "maxi" ? moltiplicatore : 1;
    const prezzoUnitario = prezzoBase + Math.max(0, extraLordo - credito) * fattoreMaxi + (impasto?.supplemento ?? 0);
    const quantita = Math.max(1, Math.round(a.quantita) || 1);
    totale += prezzoUnitario * quantita;

    // Spiegazione del prezzo: togliere un ingrediente non sconta mai da solo, ma «copre» fino al suo valore le aggiunte.
    const partiDettaglio: string[] = [];
    if (extra.length) {
      const nomiExtra = extra.map((e) => e.nome).join(", ");
      const supplemento = Math.max(0, extraLordo - credito) * fattoreMaxi;
      if (supplemento > 0) {
        partiDettaglio.push(`aggiunte (${nomiExtra}): in più ${euroT(supplemento)}${credito > 0 ? ", già al netto degli ingredienti tolti" : ""}`);
      } else if (credito > 0 && extraLordo > 0) {
        partiDettaglio.push(`aggiunte (${nomiExtra}) senza supplemento: gli ingredienti tolti (${rimossi.map((r) => r.nome).join(", ")}) compensano quelli aggiunti`);
      } else {
        partiDettaglio.push(`aggiunte (${nomiExtra}) senza supplemento`);
      }
    } else if (rimossi.length) {
      partiDettaglio.push("togliere ingredienti non cambia il prezzo della pizza");
    }
    if (impasto && impasto.supplemento > 0) partiDettaglio.push(`impasto ${impasto.nome}: in più ${euroT(impasto.supplemento)}`);
    const dettaglioPrezzo = partiDettaglio.length ? partiDettaglio.join("; ") : null;

    return {
      menuItemId: menuItem.id,
      nomeSnapshot: altraMeta ? `Metà ${menuItem.nome} / Metà ${altraMeta.nome}` : menuItem.nome,
      secondaMetaId: altraMeta?.id ?? null,
      dettaglioPrezzo,
      categoria: menuItem.categoria,
      taglia,
      prezzoSnapshot: Math.round(prezzoUnitario * 100) / 100,
      quantita,
      extra,
      rimossi: rimossi.map((r) => ({ ingredienteId: r.ingredienteId, nome: r.nome })),
      impasto,
      note: a.note ?? null,
      combo: null,
    };
  });

  return { articoli: articoliPrezzati, totale: Math.round(totale * 100) / 100 };
}
