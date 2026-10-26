import { radiciRichiesta } from "./ricerca-ingredienti";

// CASISTICHE DELLA PIZZERIA: come i clienti chiamano davvero le pizze e cosa intendiamo noi.
// L'ordine delle parole non conta e «una», «pizza», «e», «mi fai», «vorrei», «due»… vengono ignorati
// («mi fai una funghi e prosciutto» = «prosciutto e funghi»).
//
// Due tipi di casistica:
//  - `intendono` (o una sola opzione senza `chiedi`): la frase indica UNA pizza precisa → l'assistente la prende subito,
//    senza elencare alternative;
//  - `chiedi` + `opzioni`: la frase è ambigua in un solo punto → l'assistente fa quella domanda (e solo quella) e
//    poi usa l'opzione scelta. Ogni opzione dice quale pizza è e, se serve, quali ingredienti aggiungere (`conExtra`).
//
// Per aggiungerne una: nuovo blocco con le frasi che dicono i clienti (`dicono`) e i NOMI ESATTI delle pizze/ingredienti
// nel menù.
export interface OpzioneCasistica {
  risposta: string; // cosa risponde il cliente alla domanda, es. "cotto"
  pizza: string; // nome esatto della pizza nel menù
  conExtra?: string[]; // nomi esatti degli ingredienti da aggiungere
}

export interface Casistica {
  dicono?: string[];
  /** In alternativa alle frasi: un'espressione regolare sulla richiesta (per le famiglie di modi di dire). */
  pattern?: RegExp;
  intendono?: string;
  chiedi?: string;
  opzioni?: OpzioneCasistica[];
}

export const CASISTICHE_PRODOTTI: Casistica[] = [
  {
    // «La vorrei comporre», «una pizza personalizzata», «crea la tua pizza», «da zero»: si parte dalla base
    // «Crea la tua pizza» (pomodoro e mozzarella; per la bianca si toglie il pomodoro) e si aggiungono gli ingredienti.
    pattern: /compor|componi|personalizz|crea(re)? (la tua|una) pizza|da zero/i,
    intendono: "Crea la tua pizza",
  },
  {
    // «Salsiccia e funghi» NON è metà e metà (quella si dice «metà salsiccia metà funghi»): è la pizza Poldo.
    dicono: ["salsiccia e funghi"],
    intendono: "Poldo",
  },
  {
    // Non esiste una «crudo e funghi» in menù: col crudo è la pizza «Crudo» con i funghi aggiunti.
    dicono: ["prosciutto e funghi"],
    chiedi: "Prosciutto crudo, o prosciutto cotto?",
    opzioni: [
      { risposta: "cotto", pizza: "Cotto e Funghi" },
      { risposta: "crudo", pizza: "Crudo", conExtra: ["Funghi"] },
    ],
  },
  {
    // Già detto chiaro: niente domanda, è la «Crudo» con i funghi aggiunti.
    dicono: ["prosciutto crudo e funghi", "crudo e funghi"],
    opzioni: [{ risposta: "crudo", pizza: "Crudo", conExtra: ["Funghi"] }],
  },
];

export interface RisoluzioneCasistica {
  chiedi?: string;
  opzioni: { risposta?: string; pizza: string; conExtra: string[] }[];
}

const chiave = (frase: string) => radiciRichiesta(frase).sort().join("|");

const indice = new Map<string, Casistica>(CASISTICHE_PRODOTTI.flatMap((c) => (c.dicono ?? []).map((d) => [chiave(d), c] as [string, Casistica])));

// La casistica nota per questa richiesta, se c'è (altrimenti null).
export function trovaCasistica(richiesta: string): RisoluzioneCasistica | null {
  const k = chiave(richiesta);
  const c = (k ? indice.get(k) : undefined) ?? CASISTICHE_PRODOTTI.find((x) => x.pattern?.test(richiesta));
  if (!c) return null;
  if (c.opzioni?.length) {
    return { ...(c.chiedi ? { chiedi: c.chiedi } : {}), opzioni: c.opzioni.map((o) => ({ risposta: o.risposta, pizza: o.pizza, conExtra: o.conExtra ?? [] })) };
  }
  return c.intendono ? { opzioni: [{ pizza: c.intendono, conExtra: [] }] } : null;
}
