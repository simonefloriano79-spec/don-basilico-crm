import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Codici sconto dell'app ordini (es. BAFFO15 = 15% sui prodotti). Regole:
// - la percentuale si applica ai prodotti (la consegna non si sconta), come lo sconto fedeltà;
// - valido solo se attivo e dentro le date; ogni cliente lo usa al massimo `maxUsiPerCliente` volte (di default 1);
//   un ordine annullato non conta come uso (si ricontano gli ordini non annullati);
// - NON si somma allo sconto fedeltà nello stesso ordine: ne vale uno solo.

type Db = Prisma.TransactionClient | typeof prisma;

export function normalizzaCodice(valore: unknown): string {
  return String(valore ?? "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30);
}

export type EsitoCodice =
  | { ok: true; codice: string; percentuale: number }
  | { ok: false; motivo: string };

export async function verificaCodice(db: Db, codiceGrezzo: unknown, clienteId: string, adesso = new Date()): Promise<EsitoCodice> {
  const codice = normalizzaCodice(codiceGrezzo);
  if (codice.length < 3) return { ok: false, motivo: "Scrivi il codice sconto" };

  const riga = await db.codiceSconto.findUnique({ where: { codice } });
  if (!riga || !riga.attivo) return { ok: false, motivo: "Questo codice non è valido" };
  if (riga.validoDal && riga.validoDal > adesso) return { ok: false, motivo: "Questo codice non è ancora attivo" };
  if (riga.validoAl && riga.validoAl < adesso) return { ok: false, motivo: "Questo codice è scaduto" };

  const usi = await db.ordine.count({ where: { clienteId, codiceSconto: codice, stato: { not: "annullato" } } });
  if (usi >= riga.maxUsiPerCliente) {
    return { ok: false, motivo: riga.maxUsiPerCliente === 1 ? "Hai già usato questo codice" : "Hai già usato questo codice il massimo di volte" };
  }
  return { ok: true, codice, percentuale: Number(riga.percentuale) };
}

// Sconto in euro sui prodotti, arrotondato al centesimo.
export function scontoDaCodice(percentuale: number, totaleProdotti: number): number {
  return Math.round(totaleProdotti * percentuale) / 100;
}
