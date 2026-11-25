// Pizza Baby: formato piccolo che si vende SOLO dalla cassa del CRM (ordini presi di persona o al telefono).
// Non esiste nell'app ordini né nell'ordine vocale. Costa 1,50 € in meno della pizza normale; extra e supplemento
// dell'impasto restano ai prezzi normali. Vale solo per pizze rosse e bianche (non per speciali, focacce, calzoni e il resto).
export const SCONTO_BABY = 1.5;
export const CATEGORIE_BABY = new Set(["pizze_rosse", "pizze_bianche"]);

// Prezzo della pizza baby partendo da quello della pizza normale (mai sotto zero).
export function prezzoBaby(prezzoNormale: number): number {
  return Math.max(0, Math.round((prezzoNormale - SCONTO_BABY) * 100) / 100);
}
