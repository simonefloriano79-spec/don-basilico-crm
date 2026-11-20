// Disponibilità di un prodotto in una sede = due interruttori indipendenti, entrambi gestiti da ogni sede:
//  - «In vendita» (override.disponibile): permanente, resta com'è finché qualcuno non lo cambia;
//  - «Esaurito» (override.esauritoIl = quando è stato segnato): vale fino all'inizio della giornata di servizio successiva
//    (le 5:00, ora italiana) e poi decade da solo. Non c'è nessun reset da eseguire: si calcola al momento della lettura,
//    quindi un prodotto disattivato per sempre non può essere riattivato per sbaglio.
// La giornata di servizio comincia alle 5:00: chi segna «Esaurito» dopo la chiusura o a mezzanotte lo ritrova disponibile
// la sera dopo, non subito.
export function inizioGiornoServizio(adesso: Date = new Date()): Date {
  const locale = new Date(adesso.toLocaleString("en-US", { timeZone: "Europe/Rome" })); // data e ora di Roma, lette come locali
  const scarto = adesso.getTime() - locale.getTime();
  const inizio = new Date(locale);
  inizio.setHours(5, 0, 0, 0);
  if (locale.getHours() < 5) inizio.setDate(inizio.getDate() - 1);
  return new Date(inizio.getTime() + scarto);
}

// «Esaurito» ancora valido (segnato dopo l'inizio dell'attuale giornata di servizio)?
export function esauritoAttivo(esauritoIl: Date | string | null | undefined, adesso: Date = new Date()): boolean {
  if (!esauritoIl) return false;
  return new Date(esauritoIl).getTime() >= inizioGiornoServizio(adesso).getTime();
}

// Il prodotto si può ordinare in questa sede? `override` è la riga della sede (se esiste), `predefinito` la disponibilità di base del prodotto.
export function overrideDisponibile(
  override: { disponibile: boolean; esauritoIl?: Date | string | null } | null | undefined,
  predefinito = true
): boolean {
  if (!override) return predefinito;
  return override.disponibile && !esauritoAttivo(override.esauritoIl);
}
