import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Collegamento con la tessera fedeltà (schema `fedelta`, stesso database del CRM).
// Regole identiche a quelle della tessera: cicli di 5 timbri; al quinto timbro matura uno sconto del 10%
// della somma spesa nel ciclo; finché lo sconto matura e non è usato non si aggiungono altri timbri;
// usare lo sconto chiude il ciclo e ne apre uno nuovo. Il cliente si riconosce dal numero di telefono
// (nella tessera è salvato a 10 cifre senza prefisso, nel CRM come +39…: si confrontano le ultime 10 cifre).

export const TIMBRI_PER_CICLO = 5;
export const PERCENTUALE_SCONTO = 0.1;

type Db = Prisma.TransactionClient | typeof prisma;

export interface StatoTessera {
  clienteId: number;
  token: string;
  ciclo: number;
  timbri: number;
  totaleCiclo: number;
  scontoDisponibile: boolean;
  importoSconto: number; // sconto maturato (10% del totale del ciclo), 0 se non maturato
}

// Numero "nazionale" a 10 cifre (come lo salva la tessera).
export function telefonoTessera(telefono: string): string {
  const cifre = String(telefono ?? "").replace(/\D/g, "");
  return cifre.length > 10 ? cifre.slice(-10) : cifre;
}

async function leggiStato(db: Db, clienteId: number, token: string): Promise<StatoTessera> {
  const r = await db.$queryRaw<{ ciclo: number; timbri: number; totale: number }[]>`
    SELECT
      (COALESCE((SELECT max(ciclo) FROM fedelta.sconti WHERE cliente_id = ${clienteId}), 0) + 1)::int AS ciclo,
      (SELECT count(*) FROM fedelta.timbri t WHERE t.cliente_id = ${clienteId}
         AND t.ciclo = COALESCE((SELECT max(ciclo) FROM fedelta.sconti WHERE cliente_id = ${clienteId}), 0) + 1)::int AS timbri,
      (SELECT COALESCE(sum(t.importo), 0) FROM fedelta.timbri t WHERE t.cliente_id = ${clienteId}
         AND t.ciclo = COALESCE((SELECT max(ciclo) FROM fedelta.sconti WHERE cliente_id = ${clienteId}), 0) + 1)::float8 AS totale
  `;
  const s = r[0];
  const maturato = s.timbri >= TIMBRI_PER_CICLO;
  return {
    clienteId,
    token,
    ciclo: s.ciclo,
    timbri: s.timbri,
    totaleCiclo: Number(s.totale),
    scontoDisponibile: maturato,
    importoSconto: maturato ? Math.round(Number(s.totale) * PERCENTUALE_SCONTO * 100) / 100 : 0,
  };
}

// Tessera del cliente con questo telefono, se esiste. Con `blocca` blocca la riga del cliente fino a fine
// transazione (serve per assegnare timbri e sconti senza che due richieste contemporanee si pestino i piedi).
export async function statoTessera(telefono: string, db: Db = prisma, blocca = false): Promise<StatoTessera | null> {
  const tel = telefonoTessera(telefono);
  if (tel.length < 7) return null;
  const righe = blocca
    ? await db.$queryRaw<{ id: number; token: string }[]>`
        SELECT id::int AS id, token FROM fedelta.clienti
        WHERE right(regexp_replace(telefono, '\\D', '', 'g'), 10) = ${tel} ORDER BY id LIMIT 1 FOR UPDATE`
    : await db.$queryRaw<{ id: number; token: string }[]>`
        SELECT id::int AS id, token FROM fedelta.clienti
        WHERE right(regexp_replace(telefono, '\\D', '', 'g'), 10) = ${tel} ORDER BY id LIMIT 1`;
  if (!righe.length) return null;
  return leggiStato(db, righe[0].id, righe[0].token);
}

// Crea la tessera se il telefono non ne ha già una (il consenso alla privacy è già stato dato dal cliente).
export async function assicuraTessera(
  db: Db,
  p: { nome: string; telefono: string; sedeSlug: string; marketing: boolean; consensoAt: Date }
): Promise<void> {
  const tel = telefonoTessera(p.telefono);
  if (tel.length < 7) return;
  const esiste = await db.$queryRaw<{ id: number }[]>`
    SELECT id::int AS id FROM fedelta.clienti WHERE right(regexp_replace(telefono, '\\D', '', 'g'), 10) = ${tel} LIMIT 1`;
  if (esiste.length) return;
  const token = randomBytes(12).toString("hex");
  await db.$executeRaw`
    INSERT INTO fedelta.clienti (pizzeria_id, nome, telefono, token, consenso_privacy, consenso_marketing, consenso_at)
    SELECT pz.id, ${p.nome}, ${tel}, ${token}, true, ${p.marketing}, ${p.consensoAt}
    FROM fedelta.pizzerie pz WHERE pz.slug = ${p.sedeSlug}
    ON CONFLICT (telefono) DO NOTHING`;
}

// Usa lo sconto maturato per un ordine: chiude il ciclo e ne apre uno nuovo. Va chiamata DENTRO la transazione
// che crea l'ordine, dopo aver bloccato la tessera. Restituisce lo sconto pieno del ciclo (da limitare al totale ordine).
export async function usaSconto(db: Db, stato: StatoTessera, ordineId: string): Promise<number> {
  if (!stato.scontoDisponibile) throw new Error("SCONTO_NON_DISPONIBILE");
  await db.$executeRaw`
    INSERT INTO fedelta.sconti (cliente_id, ciclo, spesa_totale, importo_sconto, ordine_id)
    VALUES (${stato.clienteId}, ${stato.ciclo}, ${stato.totaleCiclo}, ${stato.importoSconto}, ${ordineId}::uuid)`;
  return stato.importoSconto;
}

// Ordine rifiutato/annullato che aveva usato lo sconto: lo sconto torna disponibile (se nel frattempo non sono
// stati assegnati timbri nel ciclo successivo; in quel caso resta com'è e va sistemato a mano).
export async function ripristinaSconto(ordineId: string, db: Db = prisma): Promise<boolean> {
  const n = await db.$executeRaw`
    DELETE FROM fedelta.sconti s
    WHERE s.ordine_id = ${ordineId}::uuid
      AND NOT EXISTS (SELECT 1 FROM fedelta.timbri t WHERE t.cliente_id = s.cliente_id AND t.ciclo = s.ciclo + 1)`;
  return n > 0;
}

// Timbro per un ordine che ha raggiunto "pronto"/"consegnato". Idempotente (un timbro per ordine). Importo = quanto
// ha pagato il cliente per i prodotti (la consegna non conta). Se il ciclo è già completo (sconto maturato e non usato) non si aggiunge nulla.
// Per ora solo gli ordini del sito; gli ordini di cassa continuano a essere timbrati dal pannello della tessera.
export async function timbraOrdine(ordineId: string, db?: Db): Promise<"timbrato" | "saltato"> {
  const lettura = db ?? prisma;
  const ordine = await lettura.ordine.findUnique({
    where: { id: ordineId },
    select: { canale: true, stato: true, clienteTelefono: true, totale: true, costoConsegna: true },
  });
  if (!ordine || ordine.canale !== "online" || !ordine.clienteTelefono) return "saltato";
  if (!["pronto", "consegnato"].includes(ordine.stato)) return "saltato";
  const importo = Math.round((parseFloat(ordine.totale.toString()) - parseFloat(ordine.costoConsegna.toString())) * 100) / 100;
  if (!(importo > 0)) return "saltato";

  const esegui = async (tx: Db): Promise<"timbrato" | "saltato"> => {
    const stato = await statoTessera(ordine.clienteTelefono!, tx, true);
    if (!stato || stato.timbri >= TIMBRI_PER_CICLO) return "saltato";
    const gia = await tx.$queryRaw<{ id: number }[]>`SELECT id::int AS id FROM fedelta.timbri WHERE ordine_id = ${ordineId}::uuid LIMIT 1`;
    if (gia.length) return "saltato";
    await tx.$executeRaw`
      INSERT INTO fedelta.timbri (cliente_id, importo, ciclo, posizione, ordine_id)
      VALUES (${stato.clienteId}, ${importo}, ${stato.ciclo}, ${stato.timbri + 1}, ${ordineId}::uuid)`;
    return "timbrato";
  };
  // Con un db già in transazione (prove) si usa quello; altrimenti se ne apre una.
  return db ? esegui(db) : prisma.$transaction((tx) => esegui(tx));
}
