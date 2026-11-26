// Menù per sede. Un prodotto senza `sedeId` è di TUTTE le pizzerie (lo gestisce solo il super admin);
// con `sedeId` è di quella pizzeria soltanto. Ogni lettura del menù deve passare da uno di questi due filtri,
// altrimenti i prodotti di una sede comparirebbero nelle altre.
export const SOLO_COMUNI = { sedeId: null };

export function menuDellaSede(sedeId: string | null | undefined) {
  return sedeId ? { OR: [{ sedeId: null }, { sedeId }] } : SOLO_COMUNI;
}
