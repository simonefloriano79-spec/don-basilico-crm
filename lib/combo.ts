// «Menù Combo»: un prezzo fisso per più prodotti (es. 2 pizze + patate + 2 bibite). Il cliente sceglie solo le bibite
// (e, per il «Menù Combo» semplice, le pizze speciali): le pizze e i contorni fissi non si modificano.
// File senza dipendenze: lo usano server (che controlla e calcola) e app (che mostra le scelte).

export interface ComboConfig {
  /** Prodotti fissi del combo (id del prodotto del menù e quantità). */
  componenti: { id: string; qta: number }[];
  /** Quante bibite sceglie il cliente. */
  bibite: number;
  /** Quante pizze speciali sceglie il cliente (0 se le pizze sono fisse). */
  pizzeSpeciali: number;
  /** Quante pizze contano per la capienza della cucina (fisse + scelte). */
  pizze: number;
}

export interface ComboScelte { bibite: string[]; pizze: string[] }

export function leggiComboConfig(v: unknown): ComboConfig | null {
  if (!v || typeof v !== "object") return null;
  const o = v as any;
  const componenti = Array.isArray(o.componenti)
    ? o.componenti
        .filter((c: any) => c && typeof c.id === "string")
        .map((c: any) => ({ id: c.id as string, qta: Math.max(1, Math.round(Number(c.qta)) || 1) }))
    : [];
  return {
    componenti,
    bibite: Math.max(0, Math.round(Number(o.bibite)) || 0),
    pizzeSpeciali: Math.max(0, Math.round(Number(o.pizzeSpeciali)) || 0),
    pizze: Math.max(0, Math.round(Number(o.pizze)) || 0),
  };
}

// «Bibite da 33cl»: Coca Cola, Fanta, Sprite, Tè. Non la birra, non le bottiglie grandi, non l'acqua da 50cl.
export const bevandaAmmessaInCombo = (nome: string) => /33\s?cl/i.test(nome) && !/birra/i.test(nome);

// Un combo è disponibile se nella pizzeria ci sono tutti i prodotti fissi e abbastanza bibite / pizze speciali da scegliere.
// `disponibili` = i prodotti attivi e non esauriti in quella sede.
export function comboDisponibileIn(combo: { comboConfig?: unknown }, disponibili: { id: string; nome: string; categoria: string }[]): boolean {
  const cfg = leggiComboConfig(combo.comboConfig);
  if (!cfg) return false;
  const ids = new Set(disponibili.map((m) => m.id));
  if (!cfg.componenti.every((c) => ids.has(c.id))) return false;
  if (cfg.bibite > 0 && !disponibili.some((m) => m.categoria === "bevande" && bevandaAmmessaInCombo(m.nome))) return false;
  if (cfg.pizzeSpeciali > 0 && !disponibili.some((m) => m.categoria === "menu_speciale")) return false;
  return true;
}

export function leggiComboScelte(v: unknown): ComboScelte {
  const lista = (x: unknown): string[] => (Array.isArray(x) ? x.filter((i): i is string => typeof i === "string") : []);
  const o = (v && typeof v === "object" ? v : {}) as any;
  return { bibite: lista(o.bibite), pizze: lista(o.pizze) };
}

// Testo per comanda, riepilogo e ordine: «Margherita, Diavola, Patate fritte | Bibite: Coca Cola 33cl, Fanta 33cl».
export function testoDettaglioCombo(componenti: string[], scelte: { bibite: string[]; pizze: string[] }): string {
  return [
    [...componenti, ...scelte.pizze].join(", "),
    scelte.bibite.length ? `Bibite: ${scelte.bibite.join(", ")}` : "",
  ].filter(Boolean).join(" | ");
}

// Conta quante volte compare ogni id (per le scelte ripetute: due Don Andrea, due Coca Cola…).
export function contaPerId(ids: string[]): Map<string, number> {
  const m = new Map<string, number>();
  ids.forEach((id) => m.set(id, (m.get(id) ?? 0) + 1));
  return m;
}
