import { prisma } from "@/lib/prisma";
import { partiLocali } from "@/lib/slot-ritiro";
import { pesoRiga } from "@/lib/peso-pizze";

export { pesoRiga };

// Capienza cucina "a peso": ogni finestra di N minuti (default 15) può
// contenere al massimo X pizze equivalenti (default 15). Conta TUTTI gli
// ordini della sede (cassa, telefono, walk-in, online), così telefonate e
// clienti al banco occupano posti e riducono quelli prenotabili online.
// Non blocca mai l'inserimento in cassa: limita solo gli slot online.

export interface ConfigCapienza {
  capacitaPizze: number;
  finestraCapacitaMin: number;
}

// Inizio (istante assoluto) della finestra che contiene `istante`.
export function inizioFinestra(istante: Date, finestraMin: number): Date {
  const p = partiLocali(istante);
  const scarto = (p.ore * 60 + p.minuti) % finestraMin;
  const base = new Date(Math.floor(istante.getTime() / 60000) * 60000);
  return new Date(base.getTime() - scarto * 60000);
}

// Carico (pizze equivalenti) per finestra nell'intervallo [da, a).
export async function caricoPerFinestra(
  sedeId: string,
  da: Date,
  a: Date,
  finestraMin: number,
  escludiOrdineId?: string
): Promise<Map<number, number>> {
  const ordini = await prisma.ordine.findMany({
    where: {
      sedeId,
      stato: { not: "annullato" },
      ...(escludiOrdineId ? { id: { not: escludiOrdineId } } : {}),
      OR: [
        { oraConsegnaComunicata: { gte: da, lt: a } },
        { oraConsegnaComunicata: null, oraRichiesta: { gte: da, lt: a } },
      ],
    },
    select: {
      oraRichiesta: true,
      oraConsegnaComunicata: true,
      items: {
        select: {
          quantita: true,
          nomeSnapshot: true,
          menuItem: { select: { categoria: true } },
          sedeExtra: { select: { categoria: true } },
        },
      },
    },
  });

  const carico = new Map<number, number>();
  for (const o of ordini) {
    const riferimento = o.oraConsegnaComunicata ?? o.oraRichiesta;
    const peso = o.items.reduce(
      (acc, i) => acc + pesoRiga(i.menuItem?.categoria ?? i.sedeExtra?.categoria, i.nomeSnapshot, i.quantita),
      0
    );
    if (!peso) continue;
    const chiave = inizioFinestra(riferimento, finestraMin).getTime();
    carico.set(chiave, (carico.get(chiave) ?? 0) + peso);
  }
  return carico;
}

export interface DisponibilitaSlot {
  iso: string;
  usati: number;
  liberi: number;
  pieno: boolean;
}

// Per ogni slot: quanto è già occupato e se un ordine di `pesoNuovo` ci sta ancora.
export async function disponibilitaSlot(
  sede: { id: string } & ConfigCapienza,
  slotIso: string[],
  pesoNuovo: number
): Promise<DisponibilitaSlot[]> {
  if (!slotIso.length) return [];
  const istanti = slotIso.map((s) => new Date(s));
  const finestra = sede.finestraCapacitaMin;
  const da = inizioFinestra(new Date(Math.min(...istanti.map((d) => d.getTime()))), finestra);
  const a = new Date(Math.max(...istanti.map((d) => d.getTime())) + finestra * 60000);
  const carico = await caricoPerFinestra(sede.id, da, a, finestra);

  return istanti.map((istante, idx) => {
    const usati = carico.get(inizioFinestra(istante, finestra).getTime()) ?? 0;
    const liberi = Math.max(0, sede.capacitaPizze - usati);
    // Un ordine più grande dell'intera capienza non entrerebbe mai: lo accettiamo solo in una finestra vuota.
    const pieno = pesoNuovo > 0 && usati > 0 && usati + pesoNuovo > sede.capacitaPizze;
    return { iso: slotIso[idx], usati, liberi, pieno };
  });
}
