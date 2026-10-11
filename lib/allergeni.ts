import { leggiComboConfig } from "@/lib/combo";

// I 14 allergeni da indicare per legge (Reg. UE 1169/2011, allegato II).
export const ALLERGENI: { codice: string; etichetta: string }[] = [
  { codice: "glutine", etichetta: "glutine" },
  { codice: "crostacei", etichetta: "crostacei" },
  { codice: "uova", etichetta: "uova" },
  { codice: "pesce", etichetta: "pesce" },
  { codice: "arachidi", etichetta: "arachidi" },
  { codice: "soia", etichetta: "soia" },
  { codice: "latte", etichetta: "latte" },
  { codice: "frutta_a_guscio", etichetta: "frutta a guscio" },
  { codice: "sedano", etichetta: "sedano" },
  { codice: "senape", etichetta: "senape" },
  { codice: "sesamo", etichetta: "sesamo" },
  { codice: "solfiti", etichetta: "solfiti" },
  { codice: "lupini", etichetta: "lupini" },
  { codice: "molluschi", etichetta: "molluschi" },
];

export const ETICHETTA_ALLERGENE: Record<string, string> = Object.fromEntries(ALLERGENI.map((a) => [a.codice, a.etichetta]));

// L'impasto (farina di grano) contiene sempre glutine: vale per tutte le preparazioni a base di impasto,
// qualunque impasto si scelga (nessun impasto è dichiarato «senza glutine»).
const BASE_PER_CATEGORIA: Record<string, string[]> = {
  pizze_rosse: ["glutine"], pizze_bianche: ["glutine"], menu_speciale: ["glutine"], calzoni: ["glutine"], focacce: ["glutine"],
};

interface IngredienteAll { allergeni?: string[] | null; allergeniDaVerificare?: boolean | null; }

export interface AllergeniCalcolati {
  lista: string[];          // codici, nell'ordine dei 14 allergeni
  daConfermare: boolean;    // almeno un dato non ancora verificato con le schede dei fornitori
}

// Allergeni di un prodotto: impasto + ingredienti (togliendo quelli rimossi, aggiungendo gli extra scelti) + extra del prodotto.
export function allergeniProdotto(
  item: { categoria: string; allergeniExtra?: string[] | null; allergeniDaVerificare?: boolean | null; ingredienti?: any[] },
  opzioni?: { rimossi?: Set<string>; aggiunti?: IngredienteAll[] }
): AllergeniCalcolati {
  const set = new Set<string>(BASE_PER_CATEGORIA[item.categoria] ?? []);
  let daConfermare = !!item.allergeniDaVerificare;
  (item.allergeniExtra ?? []).forEach((a) => set.add(a));

  const base: (IngredienteAll & { id?: string })[] = (item.ingredienti ?? []).map((ii: any) => ii.ingrediente ?? ii);
  for (const ing of base) {
    if (ing.id && opzioni?.rimossi?.has(ing.id)) continue;
    (ing.allergeni ?? []).forEach((a) => set.add(a));
    if (ing.allergeniDaVerificare) daConfermare = true;
  }
  for (const ing of opzioni?.aggiunti ?? []) {
    (ing.allergeni ?? []).forEach((a) => set.add(a));
    if (ing.allergeniDaVerificare) daConfermare = true;
  }
  return { lista: ALLERGENI.map((a) => a.codice).filter((c) => set.has(c)), daConfermare };
}

// «glutine, latte e uova» pronto da mostrare.
export function testoAllergeni(c: AllergeniCalcolati): string {
  const nomi = c.lista.map((x) => ETICHETTA_ALLERGENE[x] ?? x);
  return nomi.length ? nomi.join(", ") : "nessuno tra i 14 principali";
}

// Allergeni di un «Menù Combo»: l'unione di quelli dei prodotti che contiene e di quelli scelti (le bibite non ne hanno).
// `tuttiGliItems` = prodotti del menù con i loro ingredienti. Se un prodotto non si trova, la lista è «da confermare».
// `sceltaPendente` = il combo ha pizze a scelta non ancora scelte (menù pubblico): gli allergeni dipendono da quelle.
export function allergeniCombo(
  combo: { comboConfig?: unknown },
  tuttiGliItems: { id: string; categoria: string; allergeniExtra?: string[] | null; allergeniDaVerificare?: boolean | null; ingredienti?: any[] }[],
  pizzeScelte?: string[]
): AllergeniCalcolati & { sceltaPendente: boolean } {
  const cfg = leggiComboConfig(combo.comboConfig);
  const ids = [...(cfg?.componenti.map((c) => c.id) ?? []), ...(pizzeScelte ?? [])];
  const perId = new Map(tuttiGliItems.map((i) => [i.id, i]));
  const set = new Set<string>();
  let daConfermare = !cfg;
  for (const id of ids) {
    const it = perId.get(id);
    if (!it) { daConfermare = true; continue; }
    const a = allergeniProdotto(it);
    a.lista.forEach((x) => set.add(x));
    if (a.daConfermare) daConfermare = true;
  }
  const sceltaPendente = !!cfg && cfg.pizzeSpeciali > 0 && (pizzeScelte?.length ?? 0) < cfg.pizzeSpeciali;
  return { lista: ALLERGENI.map((a) => a.codice).filter((c) => set.has(c)), daConfermare, sceltaPendente };
}
