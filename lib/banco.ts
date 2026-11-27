// Vendita al banco dei tranci (puro: cassa e server). Per ora solo la sede Università.
// I prezzi stanno qui: il server ricalcola sempre il totale da questa lista.
export const SEDI_BANCO = ["universita"];

export const TRANCI = [
  { id: "margherita", nome: "Trancio margherita", prezzo: 1.8 },
  { id: "farcito", nome: "Trancio farcito", prezzo: 2.3 },
  { id: "speciale", nome: "Trancio speciale", prezzo: 3.2 },
] as const;

export type Quantita = Record<(typeof TRANCI)[number]["id"], number>;
export const NESSUN_TRANCIO: Quantita = { margherita: 0, farcito: 0, speciale: 0 };

// Quantità arrivate da fuori: intere, mai negative, al massimo 200 per tipo.
export function quantitaValide(q: any): Quantita {
  const n = (v: unknown) => Math.min(200, Math.max(0, Math.floor(Number(v) || 0)));
  return { margherita: n(q?.margherita), farcito: n(q?.farcito), speciale: n(q?.speciale) };
}

// I tranci si possono anche mettere in un ordine (tavolo, asporto...): in cassa il loro id è «trancio:<tipo>», mentre la riga
// d'ordine si salva senza prodotto del menù, con il solo nome e prezzo.
export const idTrancio = (id: (typeof TRANCI)[number]["id"]) => `trancio:${id}`;
export const trancioDaId = (menuItemId: unknown) => TRANCI.find((t) => menuItemId === idTrancio(t.id));

// Tranci dentro le righe d'ordine (riconosciuti dal nome).
export function contaTranci(righe: { nomeSnapshot: string; quantita: number }[]): Quantita {
  const q = { ...NESSUN_TRANCIO };
  for (const r of righe) {
    const t = TRANCI.find((x) => x.nome === r.nomeSnapshot);
    if (t) q[t.id] += r.quantita;
  }
  return q;
}

export const pezziBanco = (q: Quantita) => q.margherita + q.farcito + q.speciale;

export const totaleBanco = (q: Quantita) => Math.round(TRANCI.reduce((a, t) => a + q[t.id] * t.prezzo, 0) * 100) / 100;

export const descriviBanco = (q: Quantita) =>
  TRANCI.filter((t) => q[t.id] > 0).map((t) => `${q[t.id]} ${t.id}`).join(" · ");
