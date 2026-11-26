// Peso di una riga d'ordine sulla capienza cucina (puro: usabile anche lato browser).
// Pizze rosse/bianche/speciali, calzoni, focacce e il Rollè Nutella = 1 per pezzo, maxi = doppio (riconosciuto dal nome);
// fritti, bevande, altri dolci, extra = 0.
const PESO_CATEGORIA: Record<string, number> = {
  menu_speciale: 1,
  pizze_rosse: 1,
  pizze_bianche: 1,
  calzoni: 1,
  focacce: 1,
};
// Il Rollè sta tra i dolci ma è impasto cotto in forno: conta come una pizza (gli altri dolci no).
const DOLCE_DA_FORNO = /\broll[eèé]/i;

// Per i «Menù Combo» il peso è quante pizze contiene (campo `pizze` della configurazione del combo), passato in `pizzeCombo`.
export function pesoRiga(categoria: string | null | undefined, nomeSnapshot: string, quantita: number, pizzeCombo?: number | null): number {
  if (categoria === "combo") return Math.max(0, pizzeCombo ?? 0) * quantita;
  const base = categoria === "dolci" ? (DOLCE_DA_FORNO.test(nomeSnapshot) ? 1 : 0) : categoria ? PESO_CATEGORIA[categoria] ?? 0 : 0;
  const maxi = /\(maxi\)/i.test(nomeSnapshot) ? 2 : 1;
  return base * maxi * quantita;
}
