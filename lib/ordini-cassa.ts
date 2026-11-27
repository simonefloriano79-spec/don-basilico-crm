import { prisma } from "@/lib/prisma";
import { CATEGORIE_IMPASTO, impastiDellaSede } from "@/lib/impasti";
import { calcolaOrdine, CATEGORIE_MAXI, type ArticoloPrezzato } from "@/lib/ordini-vocali/pricing";
import { CATEGORIE_BABY, prezzoBaby } from "@/lib/pizza-baby";
import { menuDellaSede, ingredientiDellaSede } from "@/lib/menu-sede";
import { esauritoAttivo, filtroIngredientiFiniti, ingredienteMancante, overrideDisponibile } from "@/lib/esauriti";
import { prezzoAggiunte } from "@/lib/compensazione";

// Righe d'ordine della cassa: il prezzo si ricalcola SEMPRE sul server (mai fidarsi di quello mandato dal browser).
// Lo usano sia «nuovo ordine» (POST /api/ordini) sia «modifica ordine» (PUT /api/ordini/[id]): stesse regole, stessi errori.
// Se una riga non è valida lancia un Error col messaggio da mostrare alla cassiera.

export type RigaDati = {
  menuItemId: string | null;
  sedeExtraId: string | null;
  nomeSnapshot: string;
  prezzoSnapshot: number;
  quantita: number;
  noteItem: string | null;
  impasto: string | null;
  impastoId?: string | null;
  ingredientiRimossi: string[];
  ingredientiAggiunti?: string[];
  comboScelte?: object;
};

// Riga già presente nell'ordine che si sta modificando (si può tenere così com'è, cambiando solo la quantità).
export type RigaEsistente = {
  id: string; menuItemId: string | null; sedeExtraId: string | null; nomeSnapshot: string; prezzoSnapshot: unknown; quantita: number;
  noteItem: string | null; impasto: string | null; impastoId: string | null; ingredientiRimossi: string[]; ingredientiAggiunti: string[]; comboScelte: unknown;
};

export async function prezzaRigheCassa(sedeId: string, items: any[], esistenti: RigaEsistente[] = []): Promise<{ itemsData: RigaDati[]; totale: number }> {
  const esistentiMap = new Map(esistenti.map((e) => [e.id, e]));
  // Righe da tenere identiche (es. una pizza vecchia che non si riesce a riaprire): non si ricalcolano.
  const daRicalcolare = items.filter((i: any) => !i.conservaRigaId);

  const menuItemIds = daRicalcolare.filter((i: any) => i.menuItemId).map((i: any) => i.menuItemId);
  const sedeExtraIds = daRicalcolare.filter((i: any) => i.sedeExtraId).map((i: any) => i.sedeExtraId);
  const ingredienteIds = Array.from(new Set(daRicalcolare.flatMap((i: any) => [
    ...(i.ingredientiAggiuntiIds ?? []),
    ...(i.ingredientiRimossi ?? []),
  ])));

  const [menuItemsDb, overrideDb, sedeExtraDb, ingredientiDb, finitiDb] = await Promise.all([
    menuItemIds.length
      ? prisma.menuItem.findMany({
          where: { id: { in: menuItemIds }, ...menuDellaSede(sedeId) },
          include: { ingredienti: { select: { ingredienteId: true, ingrediente: { select: { nome: true } } } } },
        })
      : [],
    menuItemIds.length ? prisma.sedeMenuOverride.findMany({ where: { sedeId, menuItemId: { in: menuItemIds } } }) : [],
    sedeExtraIds.length ? prisma.sedeMenuExtra.findMany({ where: { id: { in: sedeExtraIds }, sedeId } }) : [],
    ingredienteIds.length ? prisma.ingrediente.findMany({ where: { id: { in: ingredienteIds as string[] }, ...ingredientiDellaSede(sedeId) } }) : [],
    // Ingredienti finiti oggi in questa sede (scadono alle 5:00 del giorno dopo, vedi lib/esauriti.ts).
    prisma.sedeIngredienteDisabilitato.findMany({ where: { sedeId, ...filtroIngredientiFiniti() }, select: { ingredienteId: true } }),
  ]);
  const ingredientiFiniti = new Set(finitiDb.map((d) => d.ingredienteId));

  // Pizza maxi: serve sapere se la sede la fa e con che moltiplicatore.
  const maxiConfig = daRicalcolare.some((i: any) => i.taglia === "maxi") ? await prisma.sedePizzaMaxi.findUnique({ where: { sedeId } }) : null;

  const impastiSede = daRicalcolare.some((i: any) => i.impastoId) ? await impastiDellaSede(sedeId) : [];
  const impastoMap = new Map(impastiSede.map((x) => [x.id, x]));
  const menuItemMap = new Map(menuItemsDb.map((m) => [m.id, m]));
  const overrideMap = new Map(overrideDb.map((o) => [o.menuItemId, o]));
  const sedeExtraMap = new Map(sedeExtraDb.map((e) => [e.id, e]));
  const ingredienteMap = new Map(ingredientiDb.map((i) => [i.id, i]));

  // «Menù Combo»: prezzo fisso; le scelte (bibite, pizze speciali) e la disponibilità in sede le controlla lo stesso
  // calcolo dell'app clienti (lib/ordini-vocali/pricing.ts), con i prezzi della cassa.
  const comboCalcolati = new Map<number, ArticoloPrezzato>();
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    if (it.conservaRigaId || !it.menuItemId || menuItemMap.get(it.menuItemId)?.categoria !== "combo") continue;
    const { articoli } = await calcolaOrdine(sedeId, [{
      menuItemId: it.menuItemId, quantita: Math.max(1, parseInt(it.quantita) || 1), comboScelte: it.comboScelte,
    }]);
    comboCalcolati.set(idx, articoli[0]);
  }

  let totale = 0;
  const itemsData: RigaDati[] = items.map((i: any, idx: number) => {
    if (i.conservaRigaId) {
      const e = esistentiMap.get(i.conservaRigaId);
      if (!e) throw new Error("Una riga dell'ordine non esiste più: riapri l'ordine e riprova");
      const quantita = Math.max(1, parseInt(i.quantita) || 1);
      const prezzo = parseFloat(String(e.prezzoSnapshot));
      totale += prezzo * quantita;
      return {
        menuItemId: e.menuItemId, sedeExtraId: e.sedeExtraId, nomeSnapshot: e.nomeSnapshot, prezzoSnapshot: prezzo, quantita,
        noteItem: e.noteItem, impasto: e.impasto, impastoId: e.impastoId, ingredientiRimossi: e.ingredientiRimossi,
        ingredientiAggiunti: e.ingredientiAggiunti, ...(e.comboScelte ? { comboScelte: e.comboScelte as object } : {}),
      };
    }

    const combo = comboCalcolati.get(idx);
    if (combo) {
      totale += combo.prezzoSnapshot * combo.quantita;
      return {
        menuItemId: combo.menuItemId,
        sedeExtraId: null,
        nomeSnapshot: combo.nomeSnapshot,
        prezzoSnapshot: combo.prezzoSnapshot,
        quantita: combo.quantita,
        // Comanda: cosa contiene (prodotti fissi + scelte) e, in coda, l'eventuale nota della cassiera.
        noteItem: [combo.combo!.dettaglio, typeof i.noteItem === "string" ? i.noteItem.trim().slice(0, 200) : ""].filter(Boolean).join(" | ") || null,
        impasto: null,
        ingredientiRimossi: [] as string[],
        comboScelte: combo.combo!.scelte as unknown as object,
      };
    }

    let prezzoUnitario: number;
    let maxiRiga = false;
    let babyRiga = false;

    if (i.menuItemId) {
      const menuItem = menuItemMap.get(i.menuItemId);
      if (!menuItem) throw new Error(`Prodotto non trovato: ${i.menuItemId}`);
      const override = overrideMap.get(i.menuItemId);
      // Non si può prendere un ordine con un prodotto non disponibile in questa sede, anche se lo schermo era rimasto
      // aperto da prima: esaurito oggi, disattivato, oppure con un ingrediente finito (es. il prosciutto crudo).
      if (override ? !overrideDisponibile(override) : !menuItem.disponibileDefault) {
        throw new Error(override && override.disponibile && esauritoAttivo(override.esauritoIl)
          ? `${menuItem.nome} è esaurito in questa sede: toglilo dall'ordine`
          : `${menuItem.nome} non è disponibile in questa sede: toglilo dall'ordine`);
      }
      const manca = ingredienteMancante((menuItem as any).ingredienti as { ingredienteId: string; ingrediente: { nome: string } }[], ingredientiFiniti);
      if (manca) throw new Error(`${menuItem.nome} non è disponibile: ${manca.ingrediente.nome} è finito in questa sede. Toglilo dall'ordine`);
      const base = override?.prezzoCustom != null
        ? parseFloat(override.prezzoCustom.toString())
        : parseFloat(menuItem.prezzoBase.toString());
      const trova = (id: string) => {
        const ing = ingredienteMap.get(id);
        if (!ing) throw new Error(`Ingrediente non trovato: ${id}`);
        return ing;
      };
      const aggiunte = ((i.ingredientiAggiuntiIds ?? []) as string[]).map((id) => {
        const ing = trova(id);
        if (ingredientiFiniti.has(id)) throw new Error(`${ing.nome} è finito in questa sede: toglilo dagli extra di ${menuItem.nome}`);
        return ing;
      });
      // Compensazione e cambio di mozzarella: regole in lib/compensazione.ts.
      const extra = prezzoAggiunte(aggiunte, ((i.ingredientiRimossi ?? []) as string[]).map(trova)).supplemento;
      // Impasto speciale (solo su pizze, solo se la pizzeria lo prepara): il supplemento si somma al prezzo.
      const impasto = i.impastoId ? impastoMap.get(i.impastoId) : undefined;
      if (i.impastoId && !impasto) throw new Error("L'impasto scelto non è disponibile in questa pizzeria");
      if (impasto && !CATEGORIE_IMPASTO.has(menuItem.categoria)) throw new Error(`${menuItem.nome}: l'impasto speciale non è disponibile`);
      // Pizza maxi: prezzo della pizza ed extra si moltiplicano (di norma ×2); il supplemento dell'impasto resta quello normale.
      if (i.taglia === "maxi") {
        if (!CATEGORIE_MAXI.has(menuItem.categoria)) throw new Error(`${menuItem.nome}: la versione maxi non è disponibile`);
        if (!maxiConfig?.attiva) throw new Error("La pizza maxi non è disponibile in questa pizzeria");
        maxiRiga = true;
      }
      // Pizza baby (solo cassa): 1,50 € in meno della pizza normale, extra e impasto ai prezzi normali.
      if (i.taglia === "baby") {
        if (!CATEGORIE_BABY.has(menuItem.categoria)) throw new Error(`${menuItem.nome}: la versione baby non è disponibile`);
        babyRiga = true;
      }
      const moltiplicatoreMaxi = maxiRiga ? parseFloat(maxiConfig!.moltiplicatore.toString()) : 1;
      prezzoUnitario = (babyRiga ? prezzoBaby(base) : base * moltiplicatoreMaxi) + extra * moltiplicatoreMaxi + (impasto?.supplemento ?? 0);
    } else if (i.sedeExtraId) {
      const sedeExtra = sedeExtraMap.get(i.sedeExtraId);
      if (!sedeExtra) throw new Error(`Prodotto non trovato: ${i.sedeExtraId}`);
      if (!sedeExtra.disponibile) throw new Error(`${sedeExtra.nome} non è disponibile in questa sede: toglilo dall'ordine`);
      prezzoUnitario = parseFloat(sedeExtra.prezzo.toString());
    } else {
      throw new Error("Riga ordine senza prodotto valido");
    }

    const quantita = Math.max(1, parseInt(i.quantita) || 1);
    totale += prezzoUnitario * quantita;

    return {
      menuItemId: i.menuItemId || null,
      sedeExtraId: i.sedeExtraId || null,
      nomeSnapshot: maxiRiga && !/\(maxi\)/i.test(i.nomeSnapshot ?? "") ? `${i.nomeSnapshot} (Maxi)`
        : babyRiga && !/\(baby\)/i.test(i.nomeSnapshot ?? "") ? `${i.nomeSnapshot} (Baby)` : i.nomeSnapshot,
      prezzoSnapshot: prezzoUnitario,
      quantita,
      noteItem: i.noteItem || null,
      impasto: i.impastoId ? (impastoMap.get(i.impastoId)?.nome ?? null) : null,
      // Scelte in forma strutturata: servono per poter riaprire la pizza e modificarla dopo la conferma dell'ordine.
      impastoId: i.impastoId || null,
      ingredientiRimossi: i.ingredientiRimossi || [],
      ingredientiAggiunti: i.ingredientiAggiuntiIds || [],
    };
  });

  return { itemsData, totale };
}
