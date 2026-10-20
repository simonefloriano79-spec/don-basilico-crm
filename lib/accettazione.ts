// Ordini che la pizzeria deve ACCETTARE prima di prepararli (nascono «nuovo» = «da accettare»): quelli dell'app clienti
// e quelli presi dall'assistente vocale. Gli ordini di cassa/banco/telefono presi dallo staff entrano subito in cucina.
// File senza dipendenze: lo usano sia il server sia le pagine del CRM.
export const richiedeAccettazione = (o: { canale?: string | null; daAssistente?: boolean | null } | null | undefined): boolean =>
  o?.canale === "online" || !!o?.daAssistente;

/** Filtro Prisma equivalente: ordini online o dell'assistente. */
export const FILTRO_ACCETTAZIONE = { OR: [{ canale: "online" as const }, { daAssistente: true }] };
