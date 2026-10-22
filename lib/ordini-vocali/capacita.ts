import { prisma } from "@/lib/prisma";
import { disponibilitaSlot } from "@/lib/capacita-pizze";

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

// Sede attiva e aperta all'orario richiesto.
export async function verificaSedeAperta(sedeId: string, oraRichiesta: Date): Promise<DisponibilitaSede> {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId } });
  if (!sede || !sede.attiva) return { ok: false, motivo: "Sede non attiva" };

  const { ora } = orarioLocale(oraRichiesta);
  if (ora < sede.orarioApertura || ora >= sede.orarioChiusura) {
    return { ok: false, motivo: `Sede chiusa in questo orario (apertura ${sede.orarioApertura}-${sede.orarioChiusura})` };
  }
  return { ok: true };
}

// Capienza cucina "a peso": la stessa dell'app clienti (lib/capacita-pizze.ts). Conta TUTTI gli ordini della sede
// (cassa, banco, telefono, app), non solo quelli vocali, e pesa le pizze (maxi = 2, combo = le pizze che contiene).
export async function verificaCapienza(sedeId: string, oraRichiesta: Date, pesoNuovo: number, escludiOrdineId?: string): Promise<DisponibilitaSede> {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { id: true, capacitaPizze: true, finestraCapacitaMin: true } });
  if (!sede) return { ok: false, motivo: "Sede non trovata" };

  const [disp] = await disponibilitaSlot(sede, [oraRichiesta.toISOString()], pesoNuovo, escludiOrdineId);
  if (disp?.pieno) return { ok: false, motivo: "Cucina piena per la fascia oraria richiesta: proponi al cliente un orario più tardi" };
  return { ok: true };
}
