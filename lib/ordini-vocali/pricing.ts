import { prisma } from "@/lib/prisma";

const CATEGORIE_MAXI = new Set(["pizze_rosse", "pizze_bianche"]);

export interface ArticoloOrdinatoInput {
  menuItemId: string;
  quantita: number;
  taglia?: "normale" | "maxi";
  ingredientiAggiuntiIds?: string[];
  note?: string;
}

export interface ArticoloPrezzato {
  menuItemId: string;
  nomeSnapshot: string;
  taglia: "normale" | "maxi";
  prezzoSnapshot: number;
  quantita: number;
  extra: { ingredienteId: string; nome: string; prezzo: number }[];
  note: string | null;
}

export class ErrorePricing extends Error {}

// Calcola il totale reale di un ordine vocale lato server: non fidarsi mai
// del prezzo che l'assistente potrebbe aver detto/dedotto durante la chiamata.
export async function calcolaOrdine(
  sedeId: string,
  articoli: ArticoloOrdinatoInput[]
): Promise<{ articoli: ArticoloPrezzato[]; totale: number }> {
  if (!articoli.length) throw new ErrorePricing("Nessun articolo nell'ordine");

  const menuItemIds = Array.from(new Set(articoli.map((a) => a.menuItemId)));
  const ingredienteIds = Array.from(new Set(articoli.flatMap((a) => a.ingredientiAggiuntiIds ?? [])));

  const [menuItems, ingredienti, maxiConfig] = await Promise.all([
    prisma.menuItem.findMany({ where: { id: { in: menuItemIds }, isAttivo: true } }),
    ingredienteIds.length
      ? prisma.ingrediente.findMany({ where: { id: { in: ingredienteIds } } })
      : Promise.resolve([]),
    prisma.sedePizzaMaxi.findUnique({ where: { sedeId } }),
  ]);

  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));
  const ingredienteMap = new Map(ingredienti.map((i) => [i.id, i]));
  const maxiDisponibile = !!maxiConfig?.attiva;
  const moltiplicatore = maxiConfig ? parseFloat(maxiConfig.moltiplicatore.toString()) : 1;

  let totale = 0;
  const articoliPrezzati: ArticoloPrezzato[] = articoli.map((a) => {
    const menuItem = menuItemMap.get(a.menuItemId);
    if (!menuItem) throw new ErrorePricing(`Prodotto non trovato o non disponibile: ${a.menuItemId}`);

    const taglia: "normale" | "maxi" = a.taglia === "maxi" ? "maxi" : "normale";
    if (taglia === "maxi") {
      if (!CATEGORIE_MAXI.has(menuItem.categoria)) {
        throw new ErrorePricing(`${menuItem.nome} non è disponibile in formato maxi`);
      }
      if (!maxiDisponibile) {
        throw new ErrorePricing(`La pizza maxi non è disponibile in questa sede`);
      }
    }

    const prezzoBase = parseFloat(menuItem.prezzoBase.toString()) * (taglia === "maxi" ? moltiplicatore : 1);

    const extra = (a.ingredientiAggiuntiIds ?? []).map((id) => {
      const ing = ingredienteMap.get(id);
      if (!ing) throw new ErrorePricing(`Ingrediente non trovato: ${id}`);
      return { ingredienteId: id, nome: ing.nome, prezzo: parseFloat(ing.prezzoAggiunta.toString()) };
    });

    const prezzoUnitario = prezzoBase + extra.reduce((acc, e) => acc + e.prezzo, 0);
    const quantita = Math.max(1, Math.round(a.quantita) || 1);
    totale += prezzoUnitario * quantita;

    return {
      menuItemId: menuItem.id,
      nomeSnapshot: menuItem.nome,
      taglia,
      prezzoSnapshot: Math.round(prezzoUnitario * 100) / 100,
      quantita,
      extra,
      note: a.note ?? null,
    };
  });

  return { articoli: articoliPrezzati, totale: Math.round(totale * 100) / 100 };
}
