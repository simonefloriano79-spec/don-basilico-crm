import { prisma } from "@/lib/prisma";
import { statoTessera, TIMBRI_PER_CICLO } from "@/lib/fedelta";
import { scontoDaCodice, verificaCodice, normalizzaCodice } from "@/lib/codice-sconto";

// Stesse regole dell'app (app/api/ordina/conferma): lo sconto fedeltà e i codici si applicano ai PRODOTTI (non alla
// consegna), non si sommano tra loro, e lo sconto non supera mai il totale dei prodotti.

export interface FedeltaTelefono {
  haTessera: boolean;
  timbri: number;
  timbriPerCiclo: number;
  scontoDisponibile: boolean;
  importoSconto: number;
}

export type AnteprimaSconti =
  | { ok: true; scontoFedelta: number; scontoCodice: number; codice: string | null; fedelta: FedeltaTelefono }
  | { ok: false; motivo: string };

// UUID nullo: per un cliente non ancora in anagrafica nessun ordine passato corrisponde (i conteggi d'uso risultano 0).
const CLIENTE_NUOVO = "00000000-0000-0000-0000-000000000000";

// Anteprima di sconti e stato tessera per `prepara` (sola lettura, nessun blocco: il vero controllo è in `conferma`).
export async function anteprimaSconti(p: {
  telefono: string;
  clienteId: string | null;
  totaleProdotti: number;
  usaScontoFedelta?: boolean;
  codiceSconto?: string;
}): Promise<AnteprimaSconti> {
  const stato = await statoTessera(p.telefono);
  const fedelta: FedeltaTelefono = {
    haTessera: !!stato,
    timbri: stato?.timbri ?? 0,
    timbriPerCiclo: TIMBRI_PER_CICLO,
    scontoDisponibile: !!stato?.scontoDisponibile,
    importoSconto: stato?.importoSconto ?? 0,
  };

  const codice = p.codiceSconto ? normalizzaCodice(p.codiceSconto) : "";
  if (codice && p.usaScontoFedelta) {
    return { ok: false, motivo: "Il codice sconto non si somma allo sconto fedeltà: il cliente deve sceglierne uno solo per questo ordine" };
  }

  let scontoFedelta = 0;
  if (p.usaScontoFedelta) {
    if (!stato?.scontoDisponibile) return { ok: false, motivo: "Il cliente non ha uno sconto fedeltà disponibile" };
    scontoFedelta = Math.min(stato.importoSconto, p.totaleProdotti);
  }

  let scontoCodice = 0;
  if (codice) {
    const c = await verificaCodice(prisma, codice, p.clienteId ?? CLIENTE_NUOVO, { totaleProdotti: p.totaleProdotti });
    if (!c.ok) return { ok: false, motivo: c.motivo };
    scontoCodice = Math.min(scontoDaCodice(c.percentuale, p.totaleProdotti), p.totaleProdotti);
  }

  return { ok: true, scontoFedelta, scontoCodice, codice: codice || null, fedelta };
}
