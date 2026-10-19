import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Codici sconto dell'app ordini (es. BAFFO15 = 15% sui prodotti). Regole:
// - la percentuale si applica ai prodotti (la consegna non si sconta), come lo sconto fedeltà;
// - valido solo se attivo e dentro le date (giorni interi, ora italiana); ogni cliente lo usa al massimo
//   `maxUsiPerCliente` volte (di default 1); un ordine annullato non conta come uso (si ricontano gli ordini non annullati);
// - opzioni: massimo di utilizzi in totale, spesa minima in prodotti, solo per il primo ordine dell'app;
// - NON si somma allo sconto fedeltà nello stesso ordine: ne vale uno solo.

type Db = Prisma.TransactionClient | typeof prisma;

export function normalizzaCodice(valore: unknown): string {
  return String(valore ?? "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30);
}

const euroTesto = (n: number) => `€ ${n.toFixed(2).replace(".", ",")}`;

export type EsitoCodice =
  | { ok: true; codice: string; percentuale: number; ordineMinimo: number }
  | { ok: false; motivo: string };

interface OpzioniVerifica {
  adesso?: Date;
  /** Spesa in prodotti dell'ordine: se c'è, si controlla anche la spesa minima (alla conferma dell'ordine). */
  totaleProdotti?: number;
}

export async function verificaCodice(db: Db, codiceGrezzo: unknown, clienteId: string, opzioni: OpzioniVerifica = {}): Promise<EsitoCodice> {
  const adesso = opzioni.adesso ?? new Date();
  const codice = normalizzaCodice(codiceGrezzo);
  if (codice.length < 3) return { ok: false, motivo: "Scrivi il codice sconto" };

  const riga = await db.codiceSconto.findUnique({ where: { codice } });
  if (!riga || !riga.attivo) return { ok: false, motivo: "Questo codice non è valido" };
  if (riga.validoDal && riga.validoDal > adesso) return { ok: false, motivo: "Questo codice non è ancora attivo" };
  if (riga.validoAl && riga.validoAl < adesso) return { ok: false, motivo: "Questo codice è scaduto" };

  if (riga.maxUsiTotali != null) {
    const totali = await db.ordine.count({ where: { codiceSconto: codice, stato: { not: "annullato" } } });
    if (totali >= riga.maxUsiTotali) return { ok: false, motivo: "Questo codice ha raggiunto il numero massimo di utilizzi" };
  }

  const usi = await db.ordine.count({ where: { clienteId, codiceSconto: codice, stato: { not: "annullato" } } });
  if (usi >= riga.maxUsiPerCliente) {
    return { ok: false, motivo: riga.maxUsiPerCliente === 1 ? "Hai già usato questo codice" : "Hai già usato questo codice il massimo di volte" };
  }

  if (riga.soloPrimoOrdine) {
    const precedenti = await db.ordine.count({ where: { clienteId, canale: "online", stato: { not: "annullato" } } });
    if (precedenti > 0) return { ok: false, motivo: "Questo codice vale solo per il primo ordine dell'app" };
  }

  const ordineMinimo = Number(riga.ordineMinimo);
  if (opzioni.totaleProdotti !== undefined && ordineMinimo > 0 && opzioni.totaleProdotti + 0.001 < ordineMinimo) {
    return { ok: false, motivo: `Questo codice vale per ordini da almeno ${euroTesto(ordineMinimo)} di prodotti` };
  }

  return { ok: true, codice, percentuale: Number(riga.percentuale), ordineMinimo };
}

// Sconto in euro sui prodotti, arrotondato al centesimo.
export function scontoDaCodice(percentuale: number, totaleProdotti: number): number {
  return Math.round(totaleProdotti * percentuale) / 100;
}

// ── Stato di un codice (per la pagina del CRM) ─────────────────────────────

export type StatoCodice = "attivo" | "disattivato" | "programmato" | "scaduto" | "esaurito";

export function statoCodice(
  r: { attivo: boolean; validoDal: Date | null; validoAl: Date | null; maxUsiTotali: number | null },
  usiTotali: number,
  adesso = new Date()
): StatoCodice {
  if (!r.attivo) return "disattivato";
  if (r.validoAl && r.validoAl < adesso) return "scaduto";
  if (r.validoDal && r.validoDal > adesso) return "programmato";
  if (r.maxUsiTotali != null && usiTotali >= r.maxUsiTotali) return "esaurito";
  return "attivo";
}

// ── Date a giorni interi in ora italiana ───────────────────────────────────
// Nel CRM si sceglie un giorno (es. 31 gennaio): «valido dal» parte da mezzanotte e «valido fino al» finisce alle 23:59:59
// di quel giorno, sempre ora di Roma (anche con ora legale), così il codice non scade mai «a metà giornata».

function partiRoma(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(d)) if (x.type !== "literal") p[x.type] = Number(x.value);
  return p;
}

function romaAIstante(y: number, mo: number, g: number, h: number, mi: number, s: number, ms = 0): Date {
  const voluto = Date.UTC(y, mo - 1, g, h, mi, s, ms);
  let guess = voluto;
  // Il fuso di Roma è +1h o +2h: pochi passaggi bastano a centrare l'istante anche attorno al cambio d'ora.
  for (let i = 0; i < 3; i++) {
    const d = new Date(guess);
    const p = partiRoma(d);
    const visto = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, d.getUTCMilliseconds());
    guess -= visto - voluto;
  }
  return new Date(guess);
}

/** «2027-01-07» → mezzanotte di quel giorno a Roma (null se non è una data valida). */
export function inizioGiornoRoma(iso: unknown): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return null;
  const [y, mo, g] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || g < 1 || g > 31) return null;
  const d = romaAIstante(y, mo, g, 0, 0, 0);
  const p = partiRoma(d);
  return p.year === y && p.month === mo && p.day === g ? d : null;
}

/** «2027-01-31» → le 23:59:59 di quel giorno a Roma. */
export function fineGiornoRoma(iso: unknown): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return null;
  const [y, mo, g] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || g < 1 || g > 31) return null;
  const d = romaAIstante(y, mo, g, 23, 59, 59, 999);
  const p = partiRoma(d);
  return p.year === y && p.month === mo && p.day === g ? d : null;
}

/** Istante → «2027-01-31» nel giorno di Roma (per riempire i campi data). */
export function giornoRoma(d: Date | null | undefined): string {
  if (!d) return "";
  const p = partiRoma(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
