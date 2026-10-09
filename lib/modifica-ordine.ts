// Quando il cliente può modificare o annullare un ordine fatto dall'app («I miei ordini»).
//
// Regola: fino a 30 minuti prima dell'orario concordato (quello confermato dalla pizzeria, altrimenti quello
// richiesto se prenotato) e finché l'ordine non è in preparazione. Un ordine «appena possibile» non ha un orario:
// si può cambiare solo finché la pizzeria non l'ha ancora accettato (di solito pochi minuti).
// Puro, senza dipendenze: lo usano sia il server (che decide) sia l'app (che mostra i pulsanti).

export const MINUTI_LIMITE_MODIFICA = 30;
export const MAX_MODIFICHE_CLIENTE = 2;
// Un ordine con orario richiesto oltre questa soglia dalla creazione è «prenotato»; sotto è «appena possibile».
const SOGLIA_PRENOTATO_MS = 5 * 60000;

export interface OrdineVistaCliente {
  canale: string;
  stato: string;
  createdAt: Date | string;
  oraRichiesta: Date | string;
  oraConsegnaComunicata: Date | string | null;
  modificheCliente: number;
}

export interface FinestraCliente {
  puoAnnullare: boolean;
  puoModificare: boolean;
  /** Fino a quando si può cambiare (null se «appena possibile» non ancora accettato: finché non lo accettano). */
  scadenza: Date | null;
  /** Perché non si può, in parole per il cliente (solo se non si può). */
  motivo?: string;
}

const d = (v: Date | string) => (v instanceof Date ? v : new Date(v));

export function finestraCliente(o: OrdineVistaCliente, adesso: Date = new Date()): FinestraCliente {
  const no = (motivo: string): FinestraCliente => ({ puoAnnullare: false, puoModificare: false, scadenza: null, motivo });
  if (o.canale !== "online") return no("Questo ordine non è stato fatto dall'app.");
  if (o.stato === "annullato") return no("L'ordine è già annullato.");
  if (!["nuovo", "confermato"].includes(o.stato)) return no("L'ordine è già in preparazione: per cambiare qualcosa chiama la pizzeria.");

  const prenotato = d(o.oraRichiesta).getTime() - d(o.createdAt).getTime() > SOGLIA_PRENOTATO_MS;
  const riferimento = o.oraConsegnaComunicata ? d(o.oraConsegnaComunicata) : prenotato ? d(o.oraRichiesta) : null;

  let ok: boolean;
  let scadenza: Date | null = null;
  if (riferimento) {
    scadenza = new Date(riferimento.getTime() - MINUTI_LIMITE_MODIFICA * 60000);
    ok = adesso.getTime() < scadenza.getTime();
  } else {
    // «Appena possibile»: modificabile solo finché la pizzeria non l'ha accettato.
    ok = o.stato === "nuovo";
  }
  if (!ok) return no(`Non si può più cambiare: mancano meno di ${MINUTI_LIMITE_MODIFICA} minuti. Per cambiare qualcosa chiama la pizzeria.`);

  const modificheFinite = o.modificheCliente >= MAX_MODIFICHE_CLIENTE;
  return {
    puoAnnullare: true,
    puoModificare: !modificheFinite,
    scadenza,
    motivo: modificheFinite ? `Hai già modificato questo ordine ${MAX_MODIFICHE_CLIENTE} volte: puoi ancora annullarlo, oppure chiamare la pizzeria.` : undefined,
  };
}
