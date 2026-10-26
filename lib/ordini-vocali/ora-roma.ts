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

// Come si dice a voce un orario («stasera alle ventuno e trenta»): lo costruisce il sistema, l'assistente lo legge e basta
// (nella chiamata del 26/10 il modello ha detto «domani sera» per un orario di quella sera).
const UNITA = ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
const DECINE = ["", "", "venti", "trenta", "quaranta", "cinquanta"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

function inLettere(n: number): string {
  if (n < 20) return UNITA[n];
  const dec = DECINE[Math.floor(n / 10)];
  const u = n % 10;
  if (u === 0) return dec;
  return (u === 1 || u === 8 ? dec.slice(0, -1) : dec) + UNITA[u];
}

const FORMATO_PARTI = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" });
function partiRoma(d: Date) {
  const p = Object.fromEntries(FORMATO_PARTI.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}

export function orarioParlato(quando: Date, adesso: Date = new Date()): string {
  const q = partiRoma(quando);
  const a = partiRoma(adesso);
  const giorniDiff = Math.round((Date.UTC(q.y, q.mo - 1, q.d) - Date.UTC(a.y, a.mo - 1, a.d)) / 86400000);
  const sera = q.h >= 18;
  const giorno =
    giorniDiff === 0 ? (sera ? "stasera" : "oggi")
    : giorniDiff === 1 ? (sera ? "domani sera" : "domani")
    : giorniDiff > 1 && giorniDiff < 7 ? `${GIORNI[new Date(Date.UTC(q.y, q.mo - 1, q.d)).getUTCDay()]}${sera ? " sera" : ""}`
    : `il ${inLettere(q.d)} ${MESI[q.mo - 1]}`;
  const ora = q.h === 0 ? "a mezzanotte" : q.h === 1 ? "all'una" : `alle ${inLettere(q.h)}`;
  return `${giorno} ${ora}${q.mi ? ` e ${inLettere(q.mi)}` : ""}`;
}
