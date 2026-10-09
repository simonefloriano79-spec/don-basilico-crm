import { prisma } from "@/lib/prisma";

// Limiti alla richiesta del codice SMS di registrazione. Ogni SMS ha un costo: senza limiti qualcuno potrebbe
// chiedere migliaia di codici (anche verso numeri di altri) e farci spendere. Le richieste si registrano nella tabella
// `otp_richieste` (vedi migrazione_limite_sms.sql); i conteggi sono su finestre mobili.
export const LIMITI = {
  telefono15min: 3,   // uno stesso numero: al massimo 3 codici ogni 15 minuti
  telefono24h: 8,     // … e 8 al giorno
  ip1h: 20,           // una stessa connessione: 20 all'ora (la rete mobile condivide l'indirizzo tra molte persone)
  totale24h: 500,     // freno d'emergenza: oltre questa soglia giornaliera si ferma tutto
};

export interface Conteggi { telefono15min: number; telefono24h: number; ip1h: number | null; totale24h: number }
export type EsitoLimite = { ok: true } | { ok: false; motivo: "telefono" | "ip" | "servizio"; messaggio: string };

// Decisione pura (provabile senza database).
export function valutaLimiti(c: Conteggi): EsitoLimite {
  if (c.totale24h >= LIMITI.totale24h) {
    return { ok: false, motivo: "servizio", messaggio: "Il servizio è molto richiesto in questo momento: riprova tra qualche minuto." };
  }
  if (c.telefono15min >= LIMITI.telefono15min || c.telefono24h >= LIMITI.telefono24h) {
    return { ok: false, motivo: "telefono", messaggio: "Hai già richiesto diversi codici per questo numero: aspetta qualche minuto prima di riprovare." };
  }
  if (c.ip1h !== null && c.ip1h >= LIMITI.ip1h) {
    return { ok: false, motivo: "ip", messaggio: "Troppe richieste da questa connessione: riprova tra poco." };
  }
  return { ok: true };
}

// Controlla i limiti e, se la richiesta è ammessa, la registra. Se il database non risponde (o la tabella non c'è
// ancora) NON blocca la registrazione: meglio un SMS in più che un cliente che non riesce a ordinare.
export async function controllaERegistraRichiestaOtp(telefono: string, ip: string | null): Promise<EsitoLimite> {
  try {
    const righe = await prisma.$queryRaw<{ t15: number; t24: number; ip1: number; tot: number }[]>`
      SELECT
        count(*) FILTER (WHERE telefono = ${telefono} AND created_at > now() - interval '15 minutes')::int AS t15,
        count(*) FILTER (WHERE telefono = ${telefono})::int AS t24,
        count(*) FILTER (WHERE ${ip}::text IS NOT NULL AND ip = ${ip} AND created_at > now() - interval '1 hour')::int AS ip1,
        count(*)::int AS tot
      FROM otp_richieste
      WHERE created_at > now() - interval '24 hours'`;
    const r = righe[0] ?? { t15: 0, t24: 0, ip1: 0, tot: 0 };
    const esito = valutaLimiti({ telefono15min: r.t15, telefono24h: r.t24, ip1h: ip ? r.ip1 : null, totale24h: r.tot });
    if (!esito.ok) return esito;

    await prisma.$executeRaw`INSERT INTO otp_richieste (telefono, ip) VALUES (${telefono}, ${ip})`;
    // Pulizia: ogni tanto si cancellano le richieste vecchie (servono solo le ultime 24 ore).
    if (Math.random() < 0.02) await prisma.$executeRaw`DELETE FROM otp_richieste WHERE created_at < now() - interval '3 days'`;
    return { ok: true };
  } catch (e) {
    console.error("Limite OTP non applicato (database)", e);
    return { ok: true };
  }
}
