import { radiciRichiesta } from "./ricerca-ingredienti";

// CASISTICHE DELLA PIZZERIA: come i clienti chiamano davvero le pizze e cosa intendiamo noi.
// Quando il cliente dice una di queste frasi, l'assistente prende SUBITO la pizza indicata, senza elencare alternative
// e senza chiedere quale intende. L'ordine delle parole non conta e «una», «pizza», «e»… vengono ignorati
// («mi fai una funghi e prosciutto» = «prosciutto e funghi»).
//
// Per aggiungerne una: nuova riga con le frasi che dicono i clienti (`dicono`) e il NOME ESATTO della pizza nel menù
// (`intendono`). Più frasi per la stessa pizza vanno nella stessa riga.
export const CASISTICHE_PRODOTTI: { dicono: string[]; intendono: string }[] = [
  { dicono: ["prosciutto e funghi"], intendono: "Cotto e Funghi" },
];

const chiave = (frase: string) => radiciRichiesta(frase).sort().join("|");

const indice = new Map<string, string>(
  CASISTICHE_PRODOTTI.flatMap((c) => c.dicono.map((d) => [chiave(d), c.intendono] as [string, string]))
);

// Il nome della pizza che intendiamo per questa richiesta, se è una casistica nota (altrimenti null).
export function trovaCasistica(richiesta: string): string | null {
  const k = chiave(richiesta);
  return k ? indice.get(k) ?? null : null;
}
