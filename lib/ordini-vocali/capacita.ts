import { prisma } from "@/lib/prisma";

const WEEKDAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// I server Vercel girano in UTC: per confrontare un istante con gli orari di
// apertura ("19:00") e con giorno_settimana serve sempre l'ora locale italiana,
// mai new Date().getHours()/getDay() (che userebbero il fuso del server).
export function orarioLocale(data: Date): { giorno: number; ora: string; minutiDelGiorno: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(data);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const ore = parseInt(get("hour"), 10);
  const minuti = parseInt(get("minute"), 10);

  return {
    giorno: WEEKDAY_MAP[get("weekday")],
    ora: `${String(ore).padStart(2, "0")}:${String(minuti).padStart(2, "0")}`,
    minutiDelGiorno: ore * 60 + minuti,
  };
}

export interface DisponibilitaSede {
  ok: boolean;
  motivo?: string;
}

// Verifica orario di apertura + capacità cucina per la fascia richiesta.
export async function verificaSedeDisponibile(sedeId: string, oraRichiesta: Date): Promise<DisponibilitaSede> {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId } });
  if (!sede || !sede.attiva) return { ok: false, motivo: "Sede non attiva" };

  const { ora } = orarioLocale(oraRichiesta);
  if (ora < sede.orarioApertura || ora >= sede.orarioChiusura) {
    return { ok: false, motivo: `Sede chiusa in questo orario (apertura ${sede.orarioApertura}-${sede.orarioChiusura})` };
  }

  return verificaCapacitaSlot(sedeId, oraRichiesta);
}

async function verificaCapacitaSlot(sedeId: string, oraRichiesta: Date): Promise<DisponibilitaSede> {
  const { giorno, ora, minutiDelGiorno } = orarioLocale(oraRichiesta);

  const slot = await prisma.$queryRaw<{ capacita_max: number; durata_slot_minuti: number }[]>`
    SELECT capacita_max, durata_slot_minuti
    FROM slot_cucina
    WHERE sede_id = ${sedeId}
      AND (giorno_settimana = ${giorno} OR giorno_settimana IS NULL)
      AND ora_inizio <= ${ora}::time
      AND ora_fine > ${ora}::time
    ORDER BY giorno_settimana DESC NULLS LAST
    LIMIT 1
  `;

  if (!slot.length) return { ok: true }; // nessun limite di capacità configurato per questa sede/fascia

  const { capacita_max, durata_slot_minuti } = slot[0];

  // Bucket orario (finestra di durata_slot_minuti) calcolato in modo timezone-safe:
  // sottraggo dall'istante assoluto lo scarto in minuti rispetto all'inizio del bucket.
  const scarto = minutiDelGiorno % durata_slot_minuti;
  const bucketStart = new Date(oraRichiesta.getTime() - scarto * 60000);
  const bucketEnd = new Date(bucketStart.getTime() + durata_slot_minuti * 60000);

  const occupati = await prisma.ordineVocale.count({
    where: {
      sedeId,
      stato: { not: "annullato" },
      oraRichiesta: { gte: bucketStart, lt: bucketEnd },
    },
  });

  if (occupati >= capacita_max) {
    return { ok: false, motivo: "Cucina piena per la fascia oraria richiesta" };
  }
  return { ok: true };
}
