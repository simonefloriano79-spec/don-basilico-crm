import { Prisma } from "@prisma/client";

// Genera il prossimo numero ordine per una sede: si azzera ogni giorno,
// separatamente per ciascuna sede. L'upsert è atomico (una singola query)
// così due ordini creati nello stesso istante nella stessa sede non
// ricevono mai lo stesso numero. Va sempre chiamato dentro la stessa
// transazione che crea l'Ordine, per evitare di "bruciare" un numero se
// la creazione dell'ordine poi fallisce.
export async function prossimoNumeroOrdine(
  tx: Prisma.TransactionClient,
  sedeId: string
): Promise<number> {
  const rows = await tx.$queryRaw<{ contatore: number }[]>`
    INSERT INTO ordini_contatori_giornalieri (sede_id, giorno, contatore)
    VALUES (${sedeId}::uuid, CURRENT_DATE, 1)
    ON CONFLICT (sede_id, giorno)
    DO UPDATE SET contatore = ordini_contatori_giornalieri.contatore + 1
    RETURNING contatore
  `;
  return rows[0].contatore;
}
