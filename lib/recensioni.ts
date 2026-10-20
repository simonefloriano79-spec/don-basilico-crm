// Recensioni su Google: ogni pizzeria ha la sua scheda Google Business, ma sui cartoni stampati c'è un solo QR.
// Il QR porta alla pagina /ordina/recensione (indirizzo corto: ordina.donbasilico.it/recensione), dove il cliente tocca la
// sua pizzeria. Qui si decide dove porta ogni pizzeria, senza dover ristampare nulla.
//
// Per mandare dritto alla finestra «Scrivi una recensione» si inserisce il link di Google Business della pizzeria
// (Google Business Profile → «Ottieni altre recensioni» → copia il link, tipo https://g.page/r/XXXX/review).
// Finché manca, si apre la scheda della pizzeria su Google Maps, dove basta un tocco su «Scrivi una recensione».
export const LINK_RECENSIONI: Record<string, string> = {
  // "centro": "https://g.page/r/XXXXXXXX/review",
  // "chieti-scalo": "https://g.page/r/XXXXXXXX/review",
  // "montesilvano": "https://g.page/r/XXXXXXXX/review",
  // "pescara-nord": "https://g.page/r/XXXXXXXX/review",
  // "portanuova": "https://g.page/r/XXXXXXXX/review",
  // "universita": "https://g.page/r/XXXXXXXX/review",
};

export function linkRecensione(sede: { slug: string; nome: string; indirizzo: string; citta: string }): string {
  const diretto = LINK_RECENSIONI[sede.slug];
  if (diretto) return diretto;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${sede.nome} ${sede.indirizzo} ${sede.citta}`)}`;
}
