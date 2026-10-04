import { prisma } from "@/lib/prisma";

// Data (YYYY-MM-DD) nel fuso italiano: Vercel e il database girano in UTC, ma la giornata
// di lavoro della pizzeria è quella di Roma.
export function giornoRoma(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// Prossimo numero ordine della sede per il "giorno di servizio": riparte da 1 ogni giorno, separatamente
// per ciascuna sede. Il giorno è quello dell'orario richiesto (un ordine fatto stasera per domani prende il
// numero di domani, così non si scontra con quelli presi al banco domani), altrimenti oggi.
// L'upsert è atomico (una sola query): due ordini nello stesso istante non prendono mai lo stesso numero.
// Se la tabella dei contatori non esiste ancora o la query fallisce restituisce undefined: l'ordine viene
// creato comunque con la numerazione progressiva classica del database (mai bloccare un ordine per un numero).
export async function prossimoNumeroOrdine(sedeId: string, quando?: Date | null): Promise<number | undefined> {
  try {
    const giorno = giornoRoma(quando && !Number.isNaN(quando.getTime()) ? quando : new Date());
    const righe = await prisma.$queryRaw<{ contatore: number }[]>`
      INSERT INTO ordini_contatori_giornalieri (sede_id, giorno, contatore)
      VALUES (${sedeId}::uuid, ${giorno}::date, 1)
      ON CONFLICT (sede_id, giorno)
      DO UPDATE SET contatore = ordini_contatori_giornalieri.contatore + 1
      RETURNING contatore
    `;
    return Number(righe[0].contatore);
  } catch (e) {
    console.error("Contatore ordine giornaliero non disponibile, uso la numerazione progressiva", e);
    return undefined;
  }
}
