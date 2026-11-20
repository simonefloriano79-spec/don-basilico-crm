import { prisma } from "@/lib/prisma";

// «Esaurito» che dura un giorno: un prodotto segnato «Esaurito» col tasto Disponibile/Esaurito del menù torna disponibile
// da solo all'inizio della giornata di servizio successiva. La giornata comincia alle 5:00 (ora italiana), così chi lo segna
// dopo la chiusura o a mezzanotte lo ritrova disponibile la sera dopo, non subito.
// Vale solo per i prodotti con `esauritoIl` valorizzato: quelli non venduti in una sede o bloccati da un ingrediente finito
// (esauritoIl vuoto) non vengono mai toccati.
export function inizioGiornoServizio(adesso: Date = new Date()): Date {
  const locale = new Date(adesso.toLocaleString("en-US", { timeZone: "Europe/Rome" })); // data e ora di Roma, lette come locali
  const scarto = adesso.getTime() - locale.getTime();
  const inizio = new Date(locale);
  inizio.setHours(5, 0, 0, 0);
  if (locale.getHours() < 5) inizio.setDate(inizio.getDate() - 1);
  return new Date(inizio.getTime() + scarto);
}

let ultimoControllo = 0;

// Rimette disponibili i prodotti «Esaurito» di giorni precedenti. Si chiama da un controllo giornaliero (Vercel cron)
// e, per sicurezza, all'apertura del menù e a ogni ordine (al massimo una volta al minuto per istanza).
export async function resetEsauritiScaduti(opzioni?: { forza?: boolean }): Promise<number> {
  const ora = Date.now();
  if (!opzioni?.forza && ora - ultimoControllo < 60_000) return 0;
  ultimoControllo = ora;
  try {
    const r = await prisma.sedeMenuOverride.updateMany({
      where: { disponibile: false, esauritoIl: { not: null, lt: inizioGiornoServizio() } },
      data: { disponibile: true, esauritoIl: null },
    });
    return r.count;
  } catch (e: any) {
    console.error("Reset esauriti non riuscito:", e?.message ?? e);
    return 0;
  }
}
