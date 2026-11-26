// L'ordine che si sta prendendo in cassa (non ancora confermato) resta salvato su quel computer: se la pagina si ricarica
// o la scheda si chiude, riaprendo si ritrovano pizze, nome, telefono e indirizzo. Si cancella alla conferma, col tasto
// «Cancella», e comunque dopo 3 ore (sono dati del cliente: non devono restare sul computer più del necessario).

const DURATA_MS = 3 * 3600 * 1000;
const chiave = (sedeId: string) => `cassa_bozza_${sedeId}`;

export interface BozzaCassa {
  cart: any[];
  canale: "walk_in" | "telefono";
  tipo: "asporto" | "domicilio" | "tavolo";
  tavolo: string;
  clienteNome: string;
  clienteTel: string;
  clienteIndirizzo: string;
  nomeCitofono: string;
  costoConsegna: string;
  note: string;
  noteDomicilio: string;
  oraConsegna: string;
  modConsegna: string;
  metodoPagamento: "contanti" | "pos" | "";
  domandeFatte: string[];
  // La pagina si è chiusa mentre l'ordine stava partendo: prima di riconfermarlo va controllato se è già in «Ordini».
  daControllare: boolean;
}

// C'è qualcosa che valga la pena tenere? (solo aver toccato asporto/domicilio non conta)
export const bozzaPiena = (b: Partial<BozzaCassa>): boolean =>
  !!(b.cart?.length || b.tavolo || b.clienteNome || b.clienteTel || b.clienteIndirizzo || b.nomeCitofono || b.note || b.noteDomicilio);

export function leggiBozza(sedeId: string): BozzaCassa | null {
  try {
    const salvata = JSON.parse(localStorage.getItem(chiave(sedeId)) ?? "null");
    if (!salvata || Date.now() - salvata.quando > DURATA_MS || !Array.isArray(salvata.bozza?.cart) || !bozzaPiena(salvata.bozza)) {
      localStorage.removeItem(chiave(sedeId));
      return null;
    }
    return salvata.bozza as BozzaCassa;
  } catch {
    return null; // storage non disponibile o dato rovinato: si parte da vuoto
  }
}

export function salvaBozza(sedeId: string, bozza: BozzaCassa) {
  try {
    if (!bozzaPiena(bozza)) localStorage.removeItem(chiave(sedeId));
    else localStorage.setItem(chiave(sedeId), JSON.stringify({ quando: Date.now(), bozza }));
  } catch { /* storage non disponibile */ }
}

export function cancellaBozza(sedeId: string) {
  try { localStorage.removeItem(chiave(sedeId)); } catch { /* storage non disponibile */ }
}
