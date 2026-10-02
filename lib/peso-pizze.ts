// Peso di una riga d'ordine sulla capienza cucina (puro: usabile anche lato browser).
// Pizze rosse/bianche e calzoni = 1 per pezzo, maxi = doppio (riconosciuto dal nome);
// fritti, bevande, dolci, extra = 0.
const PESO_CATEGORIA: Record<string, number> = {
  pizze_rosse: 1,
  pizze_bianche: 1,
  calzoni: 1,
};

export function pesoRiga(categoria: string | null | undefined, nomeSnapshot: string, quantita: number): number {
  const base = categoria ? PESO_CATEGORIA[categoria] ?? 0 : 0;
  const maxi = /\(maxi\)/i.test(nomeSnapshot) ? 2 : 1;
  return base * maxi * quantita;
}
