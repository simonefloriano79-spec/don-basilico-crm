import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fineGiornoRoma, giornoRoma, inizioGiornoRoma, normalizzaCodice, statoCodice } from "@/lib/codice-sconto";

// Gestione dei codici sconto dal CRM (solo super admin). Qui: controllo accessi, lettura e validazione dei campi.

export async function soloSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { errore: NextResponse.json({ error: "Non autorizzato" }, { status: 401 }) } as const;
  if ((session.user as any).ruolo !== "super_admin") return { errore: NextResponse.json({ error: "Permesso negato" }, { status: 403 }) } as const;
  return { ok: true } as const;
}

export interface DatiCodice {
  percentuale?: number;
  descrizione?: string | null;
  validoDal?: Date | null;
  validoAl?: Date | null;
  maxUsiPerCliente?: number;
  maxUsiTotali?: number | null;
  ordineMinimo?: number;
  soloPrimoOrdine?: boolean;
  attivo?: boolean;
}

const vuoto = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

// Legge e controlla i campi inviati dalla pagina. Con `completo` (creazione) i valori mancanti prendono il default.
export function leggiDatiCodice(body: any, completo: boolean): { errore: string } | { dati: DatiCodice } {
  const dati: DatiCodice = {};

  if (completo || body.percentuale !== undefined) {
    const p = Number(String(body.percentuale ?? "").replace(",", "."));
    if (!Number.isFinite(p) || p <= 0 || p > 100) return { errore: "La percentuale deve essere tra 1 e 100" };
    dati.percentuale = Math.round(p * 100) / 100;
  }
  if (completo || body.descrizione !== undefined) {
    dati.descrizione = vuoto(body.descrizione) ? null : String(body.descrizione).trim().slice(0, 200);
  }

  if (completo || body.validoDal !== undefined) {
    if (vuoto(body.validoDal)) dati.validoDal = null;
    else {
      const d = inizioGiornoRoma(String(body.validoDal).trim());
      if (!d) return { errore: "La data «valido dal» non è valida" };
      dati.validoDal = d;
    }
  }
  if (completo || body.validoAl !== undefined) {
    if (vuoto(body.validoAl)) dati.validoAl = null;
    else {
      const d = fineGiornoRoma(String(body.validoAl).trim());
      if (!d) return { errore: "La data «valido fino al» non è valida" };
      dati.validoAl = d;
    }
  }

  if (completo || body.maxUsiPerCliente !== undefined) {
    const n = vuoto(body.maxUsiPerCliente) ? 1 : Number(body.maxUsiPerCliente);
    if (!Number.isInteger(n) || n < 1 || n > 99) return { errore: "Gli utilizzi per cliente devono essere da 1 a 99" };
    dati.maxUsiPerCliente = n;
  }
  if (completo || body.maxUsiTotali !== undefined) {
    if (vuoto(body.maxUsiTotali)) dati.maxUsiTotali = null;
    else {
      const n = Number(body.maxUsiTotali);
      if (!Number.isInteger(n) || n < 1 || n > 1000000) return { errore: "Il limite di utilizzi totali deve essere un numero intero da 1 in su (o vuoto per nessun limite)" };
      dati.maxUsiTotali = n;
    }
  }
  if (completo || body.ordineMinimo !== undefined) {
    const n = vuoto(body.ordineMinimo) ? 0 : Number(String(body.ordineMinimo).replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 1000) return { errore: "La spesa minima non è valida" };
    dati.ordineMinimo = Math.round(n * 100) / 100;
  }
  if (completo || body.soloPrimoOrdine !== undefined) dati.soloPrimoOrdine = body.soloPrimoOrdine === true;
  if (body.attivo !== undefined) dati.attivo = body.attivo === true;
  else if (completo) dati.attivo = true;

  return { dati };
}

export function codiceDaBody(body: any): { errore: string } | { codice: string } {
  const grezzo = String(body?.codice ?? "").trim().toUpperCase();
  const codice = normalizzaCodice(grezzo);
  if (codice.length < 3) return { errore: "Il codice deve avere almeno 3 caratteri" };
  if (codice !== grezzo) return { errore: "Il codice può contenere solo lettere, numeri, trattino e underscore (senza spazi)" };
  return { codice };
}

// Riga pronta per la pagina: numeri normali, giorni in ora italiana, stato calcolato.
export function rigaPerPagina(r: any, usi: number, scontoTotale: number) {
  return {
    id: r.id,
    codice: r.codice,
    percentuale: Number(r.percentuale),
    descrizione: r.descrizione,
    attivo: r.attivo,
    validoDal: giornoRoma(r.validoDal),
    validoAl: giornoRoma(r.validoAl),
    maxUsiPerCliente: r.maxUsiPerCliente,
    maxUsiTotali: r.maxUsiTotali,
    ordineMinimo: Number(r.ordineMinimo),
    soloPrimoOrdine: r.soloPrimoOrdine,
    usi,
    scontoTotale: Math.round(scontoTotale * 100) / 100,
    stato: statoCodice(r, usi),
  };
}
