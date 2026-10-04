// Orari di ritiro/consegna prenotabili dal cliente. Logica pura (nessun DB,
// nessun fuso del server): tutto è calcolato in ora italiana (Europe/Rome),
// perché i server Vercel girano in UTC.

const FUSO = "Europe/Rome";

export interface PartiLocali {
  anno: number;
  mese: number;
  giorno: number;
  ore: number;
  minuti: number;
}

export function partiLocali(d: Date): PartiLocali {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const n = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
  return { anno: n("year"), mese: n("month"), giorno: n("day"), ore: n("hour") % 24, minuti: n("minute") };
}

export function aMinuti(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function daMinuti(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function dataLocale(d: Date): string {
  const p = partiLocali(d);
  return `${p.anno}-${String(p.mese).padStart(2, "0")}-${String(p.giorno).padStart(2, "0")}`;
}

function aggiungiGiorni(data: string, giorni: number): string {
  const [y, m, d] = data.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + giorni));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

function offsetRomaMin(utc: Date): number {
  const p = partiLocali(utc);
  const comeUtc = Date.UTC(p.anno, p.mese - 1, p.giorno, p.ore, p.minuti);
  return Math.round((comeUtc - Math.floor(utc.getTime() / 60000) * 60000) / 60000);
}

// "2026-10-03" + "20:30" (ora di Roma) → istante reale (gestisce ora legale).
export function istanteRoma(data: string, hhmm: string): Date {
  const [y, m, d] = data.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const tentativo = new Date(Date.UTC(y, m - 1, d, h, mi));
  const off1 = offsetRomaMin(tentativo);
  const risultato = new Date(tentativo.getTime() - off1 * 60000);
  const off2 = offsetRomaMin(risultato);
  return off2 === off1 ? risultato : new Date(tentativo.getTime() - off2 * 60000);
}

export type GiornoRitiro = "oggi" | "domani";

export interface SlotGenerati {
  apertoOra: boolean;
  primoGiorno: GiornoRitiro;
  oggi: { ora: string; iso: string }[];
  domani: { ora: string; iso: string }[];
}

export function generaSlot(opts: {
  adesso: Date;
  apertura: string;
  chiusura: string;
  passoMin?: number;
  anticipoMin?: number;
}): SlotGenerati {
  const passo = opts.passoMin ?? 10;
  const anticipo = opts.anticipoMin ?? 20;
  const ap = aMinuti(opts.apertura);
  const ch = aMinuti(opts.chiusura);
  const p = partiLocali(opts.adesso);
  const nowMin = p.ore * 60 + p.minuti;
  const dataOggi = dataLocale(opts.adesso);
  const dataDomani = aggiungiGiorni(dataOggi, 1);

  const arrotonda = (min: number) => Math.ceil(min / passo) * passo;
  const costruisci = (data: string, daMin: number) => {
    const out: { ora: string; iso: string }[] = [];
    for (let m = daMin; m < ch; m += passo) {
      const ora = daMinuti(m);
      out.push({ ora, iso: istanteRoma(data, ora).toISOString() });
    }
    return out;
  };

  const oggi = costruisci(dataOggi, Math.max(arrotonda(ap), arrotonda(nowMin + anticipo)));
  const domani = costruisci(dataDomani, arrotonda(ap));

  return {
    apertoOra: nowMin >= ap && nowMin < ch,
    primoGiorno: oggi.length ? "oggi" : "domani",
    oggi,
    domani,
  };
}

// "oggi" / "domani" / "03/10" rispetto a adesso, per le etichette.
export function etichettaGiorno(istante: Date, adesso: Date = new Date()): string {
  const d = dataLocale(istante);
  const oggi = dataLocale(adesso);
  if (d === oggi) return "oggi";
  if (d === aggiungiGiorni(oggi, 1)) return "domani";
  const [, m, g] = d.split("-");
  return `${g}/${m}`;
}

export function oraLocaleHHMM(istante: Date): string {
  const p = partiLocali(istante);
  return daMinuti(p.ore * 60 + p.minuti);
}
