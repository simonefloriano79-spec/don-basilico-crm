// Id corti per l'assistente vocale: ogni parola che il modello deve scrivere in una chiamata agli strumenti costa
// tempo (un id completo sono ~25 «pezzi» di testo, un codice di 8 caratteri ~5). `cerca_menu` restituisce codici
// brevi; gli strumenti accettano sia i codici sia gli id completi (ad esempio quelli di un ordine già salvato).
export const idBreve = (id: string) => id.replace(/-/g, "").slice(0, 8).toLowerCase();

export const èCodiceBreve = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}$/i.test(v);

// Trova l'id completo tra quelli noti: null se nessuno corrisponde, "ambiguo" se più di uno.
export function risolviCodice(codice: string, idNoti: string[]): string | "ambiguo" | null {
  const k = codice.toLowerCase();
  const trovati = idNoti.filter((id) => idBreve(id) === k);
  return trovati.length === 1 ? trovati[0] : trovati.length > 1 ? "ambiguo" : null;
}
