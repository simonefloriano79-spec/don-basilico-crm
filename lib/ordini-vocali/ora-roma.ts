// L'orario che il cliente dice al telefono è sempre ora di Roma. I modelli scrivono l'offset (+01:00 / +02:00) a memoria
// e nei giorni del cambio ora sbagliano (es. 19:00+02:00 il giorno in cui torna l'ora solare = le 18:00 → «pizzeria chiusa»).
// Per i due offset di Roma si legge quindi solo l'ora scritta, interpretata a Roma; "Z" e gli altri offset restano com'erano.
const FORMATO_ROMA = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function offsetRomaMs(istanteMs: number): number {
  const p = Object.fromEntries(FORMATO_ROMA.formatToParts(new Date(istanteMs)).map((x) => [x.type, x.value]));
  const comeUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return comeUtc - Math.floor(istanteMs / 1000) * 1000;
}

export function oraRomaDaTesto(testo: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i.exec(testo.trim());
  const offset = m?.[7];
  if (!m || (offset && !/^\+0?[12]:?00$/.test(offset))) return new Date(testo);
  const scritto = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  let utc = scritto - offsetRomaMs(scritto);
  utc = scritto - offsetRomaMs(utc);
  return new Date(utc);
}
