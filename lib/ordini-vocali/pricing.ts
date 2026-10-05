import { prisma } from "@/lib/prisma";
import { CATEGORIE_IMPASTO, impastiDellaSede } from "@/lib/impasti";

const CATEGORIE_MAXI = new Set(["pizze_rosse", "pizze_bianche"]);

export interface ArticoloOrdinatoInput {
  menuItemId: string;
  quantita: number;
  taglia?: "normale" | "maxi";
  ingredientiAggiuntiIds?: string[];
  ingredientiRimossi?: string[];
  impastoId?: string;
  note?: string;
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
  note: string | null;
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
  articoli: ArticoloOrdinatoInput[]
): Promise<{ articoli: ArticoloPrezzato[]; totale: number }> {
  if (!articoli.length) throw new ErrorePricing("Nessun articolo nell'ordine");

  const menuItemIds = Array.from(new Set(articoli.map((a) => a.menuItemId)));
  const ingredienteIds = Array.from(
    new Set(articoli.flatMap((a) => [...(a.ingredientiAggiuntiIds ?? []), ...(a.ingredientiRimossi ?? [])]))
  );

  const impastiSede = articoli.some((a) => a.impastoId) ? await impastiDellaSede(sedeId) : [];
  const impastoMap = new Map(impastiSede.map((i) => [i.id, i]));

  const [menuItems, ingredienti, maxiConfig, overrides, disabilitati] = await Promise.all([
    prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, isAttivo: true },
      include: { ingredienti: { select: { ingredienteId: true } } },
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

  let totale = 0;
  const articoliPrezzati: ArticoloPrezzato[] = articoli.map((a) => {
    const menuItem = menuItemMap.get(a.menuItemId);
    if (!menuItem) throw new ErrorePricing(`Prodotto non trovato o non disponibile: ${a.menuItemId}`);

    const override = overrideMap.get(menuItem.id);
    if (override && override.disponibile === false) {
      throw new ErrorePricing(`${menuItem.nome} non è disponibile in questa sede`);
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

    const prezzoListino = override?.prezzoCustom
      ? parseFloat(override.prezzoCustom.toString())
      : parseFloat(menuItem.prezzoBase.toString());
    const prezzoBase = prezzoListino * (taglia === "maxi" ? moltiplicatore : 1);

    const extra = (a.ingredientiAggiuntiIds ?? []).map((id) => {
      const ing = ingredienteMap.get(id);
      if (!ing) throw new ErrorePricing(`Ingrediente non trovato: ${id}`);
      if (ingDisabilitati.has(id)) throw new ErrorePricing(`${ing.nome} non è disponibile in questa sede`);
      return { ingredienteId: id, nome: ing.nome, prezzo: parseFloat(ing.prezzoAggiunta.toString()) };
    });

    const baseIds = new Set(menuItem.ingredienti.map((i) => i.ingredienteId));
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
    const prezzoUnitario = prezzoBase + Math.max(0, extraLordo - credito) + (impasto?.supplemento ?? 0);
    const quantita = Math.max(1, Math.round(a.quantita) || 1);
    totale += prezzoUnitario * quantita;

    return {
      menuItemId: menuItem.id,
      nomeSnapshot: menuItem.nome,
      categoria: menuItem.categoria,
      taglia,
      prezzoSnapshot: Math.round(prezzoUnitario * 100) / 100,
      quantita,
      extra,
      rimossi: rimossi.map((r) => ({ ingredienteId: r.ingredienteId, nome: r.nome })),
      impasto,
      note: a.note ?? null,
    };
  });

  return { articoli: articoliPrezzati, totale: Math.round(totale * 100) / 100 };
}
