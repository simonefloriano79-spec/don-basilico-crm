// Nomi corti degli ingredienti usati SOLO in cassa (schermata, carrello e comanda): è come li chiamano le cassiere.
// App clienti, menù pubblico, allergeni e database restano con il nome completo.
const NOMI_CORTI: Record<string, string> = {
  "patatine fritte": "Chips",
  "prosciutto cotto": "Cotto",
  "prosciutto crudo": "Crudo",
  "funghi porcini": "Porcini",
};

export function nomeCassa(nome: string): string {
  return NOMI_CORTI[nome.trim().toLowerCase()] ?? nome;
}

// Richieste frequenti al telefono o al banco: non cambiano il prezzo, vanno nella nota della pizza (e quindi sulla comanda).
export const RICHIESTE_RAPIDE = ["POCO POMODORO", "POCA MOZZARELLA"];

const parti = (nota: string) => nota.split(",").map((s) => s.trim()).filter(Boolean);

export function haRichiesta(nota: string, richiesta: string): boolean {
  return parti(nota).some((p) => p.toUpperCase() === richiesta);
}

export function cambiaRichiesta(nota: string, richiesta: string): string {
  const altre = parti(nota).filter((p) => p.toUpperCase() !== richiesta);
  return (haRichiesta(nota, richiesta) ? altre : [...altre, richiesta]).join(", ");
}
