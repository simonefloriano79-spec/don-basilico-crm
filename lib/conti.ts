// Conti della serata: finestra del «giorno di servizio» (dalle 5:00 alle 5:00 del giorno dopo, ora di Roma).
// Gli ordini presi dopo mezzanotte appartengono alla serata precedente, come per gli «esauriti».
const TZ = "Europe/Rome";

// Differenza tra l'istante reale e la «data e ora di Roma» letta come locale del server (come in lib/esauriti.ts).
function scarto(istante: Date): number {
  const locale = new Date(istante.toLocaleString("en-US", { timeZone: TZ }));
  return istante.getTime() - locale.getTime();
}

// Istante in cui a Roma sono le `ora`:00 del giorno y-m-d.
function istanteRoma(y: number, m: number, d: number, ora: number): Date {
  const w = new Date(y, m - 1, d, ora, 0, 0, 0);
  let t = w.getTime();
  for (let i = 0; i < 2; i++) t = w.getTime() + scarto(new Date(t));
  return new Date(t);
}

export function giornoServizioOggi(adesso: Date = new Date()): string {
  const locale = new Date(adesso.toLocaleString("en-US", { timeZone: TZ }));
  if (locale.getHours() < 5) locale.setDate(locale.getDate() - 1);
  const y = locale.getFullYear(), m = String(locale.getMonth() + 1).padStart(2, "0"), d = String(locale.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dataValida(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00:00Z").getTime());
}

export function finestraServizio(data: string): { data: string; inizio: Date; fine: Date } {
  const [y, m, d] = data.split("-").map(Number);
  const domani = new Date(Date.UTC(y, m - 1, d + 1));
  return {
    data,
    inizio: istanteRoma(y, m, d, 5),
    fine: istanteRoma(domani.getUTCFullYear(), domani.getUTCMonth() + 1, domani.getUTCDate(), 5),
  };
}
