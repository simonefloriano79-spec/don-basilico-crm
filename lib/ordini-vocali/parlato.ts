// Nomi di prodotti e ingredienti come l'assistente li dice a voce. Il motore vocale (v4) legge «4 Formaggi» come
// «for formaggi» e mette male l'accento su «gorgonzola»: scriviamo i numeri in lettere e l'accento già nei dati
// che l'assistente legge (solo in uscita verso la voce; nel database i nomi restano quelli del menù).
const CIFRE = ["", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove"];
const CHIAVI_TESTO = new Set(["nome", "descrizione", "senza", "conExtra", "contiene", "dettaglioPrezzo"]);

export function nomeParlato(testo: string): string {
  return testo
    .replace(/(?<![\d.,/])([1-9])(?![\d.,%/]|\s?(?:cl|l|kg|g)\b)/gi, (_m, c: string) => CIFRE[Number(c)])
    .replace(/gorgonzola/gi, (m) => (m[0] === "G" ? "Gorgonzòla" : "gorgonzòla"));
}

// Applica nomeParlato ai soli campi di testo da leggere (mai id, telefoni, orari, indirizzi).
export function parlatoDeep<T>(valore: T, chiave?: string): T {
  if (typeof valore === "string") return (chiave && CHIAVI_TESTO.has(chiave) ? nomeParlato(valore) : valore) as T;
  if (Array.isArray(valore)) return valore.map((v) => (typeof v === "string" ? parlatoDeep(v, chiave) : parlatoDeep(v))) as T;
  if (valore && typeof valore === "object") {
    return Object.fromEntries(Object.entries(valore as Record<string, unknown>).map(([k, v]) => [k, parlatoDeep(v, k)])) as T;
  }
  return valore;
}
