// Cosa va in friggitoria (secondo foglietto della comanda): i prodotti della categoria «fritti», anche quando stanno
// dentro un «Menù Combo». Le patatine messe come aggiunta su una pizza restano sulla comanda, non qui.
import { leggiComboConfig } from "@/lib/combo";

export interface RigaFritti {
  nome: string;
  qty: number;
  note?: string;
}

export interface ItemPerFritti {
  nomeSnapshot: string;
  quantita: number;
  noteItem?: string | null;
  menuItem?: { categoria: string; comboConfig?: unknown } | null;
}

// Id di tutti i prodotti contenuti nei combo dell'ordine: servono i loro nomi e categorie.
export function idComponentiCombo(items: ItemPerFritti[]): string[] {
  return Array.from(new Set(items.flatMap((i) =>
    i.menuItem?.categoria === "combo" ? leggiComboConfig(i.menuItem.comboConfig)?.componenti.map((c) => c.id) ?? [] : [])));
}

// `componentiFritti` = id → nome dei soli componenti dei combo che sono fritti. Righe uguali si sommano.
export function frittiDellOrdine(items: ItemPerFritti[], componentiFritti: Map<string, string>): RigaFritti[] {
  const righe = new Map<string, RigaFritti>();
  const aggiungi = (nome: string, qty: number, note?: string) => {
    const chiave = `${nome}|${note ?? ""}`;
    const riga = righe.get(chiave);
    if (riga) riga.qty += qty;
    else righe.set(chiave, { nome, qty, ...(note ? { note } : {}) });
  };
  for (const i of items) {
    if (i.menuItem?.categoria === "fritti") aggiungi(i.nomeSnapshot, i.quantita, i.noteItem?.trim() || undefined);
    else if (i.menuItem?.categoria === "combo") {
      for (const c of leggiComboConfig(i.menuItem.comboConfig)?.componenti ?? []) {
        const nome = componentiFritti.get(c.id);
        if (nome) aggiungi(nome, c.qta * i.quantita);
      }
    }
  }
  return Array.from(righe.values());
}
