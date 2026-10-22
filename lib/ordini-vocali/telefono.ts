import { COSTO_CONSEGNA_DEFAULT } from "@/lib/consegna";
import type { RichiestaOrdine } from "./orchestrazione";

// Dati in più che servono solo all'ordine per telefono (l'app li raccoglie nel suo carrello).
export interface RichiestaTelefonica extends RichiestaOrdine {
  nomeCitofono?: string; // nome sul citofono, solo domicilio
  metodoPagamento?: "contanti" | "carta" | "pos"; // obbligatorio per il domicilio; "carta" = POS al fattorino
  usaScontoFedelta?: boolean; // il cliente vuole usare lo sconto maturato sulla tessera
  codiceSconto?: string; // es. BAFFO15; non si somma allo sconto fedeltà
  attivaTessera?: boolean; // SOLO se il cliente, a voce, ha detto sì alla tessera fedeltà (consenso privacy verbale)
}

export type MetodoPagamentoSalvato = "contanti" | "pos";

// Dati obbligatori che l'assistente può dimenticare (es. il telefono quando il numero chiamante è nascosto): invece di un
// errore tecnico, torna un messaggio che dice COSA chiedere al cliente.
export function datiMancanti(r: Partial<RichiestaTelefonica>): string | null {
  const mancanti = [
    !r.clienteNome && "il nome del cliente",
    !r.clienteTelefono && "il numero di telefono (chiedilo al cliente per l'SMS di conferma)",
    !r.tipo && "se è consegna a domicilio o ritiro",
    !r.articoli?.length && "gli articoli",
  ].filter(Boolean);
  return mancanti.length ? `Mancano dei dati: ${mancanti.join(", ")}. Chiedili al cliente e poi richiama questo strumento.` : null;
}

// Controlli sui dati che l'assistente può dimenticare: meglio scoprirlo a «prepara», prima di dire il totale,
// che a «conferma», quando il cliente ha già detto di sì.
export function validaDatiTelefonici(r: RichiestaTelefonica): string | null {
  if (r.tipo === "domicilio" && !normalizzaPagamento(r.metodoPagamento)) {
    return "Per la consegna serve sapere come paga il cliente: contanti o carta (POS al fattorino)";
  }
  return null;
}

export function normalizzaPagamento(m: unknown): MetodoPagamentoSalvato | null {
  if (m === "contanti") return "contanti";
  if (m === "pos" || m === "carta") return "pos";
  return null;
}

export function nomeCitofonoPulito(r: RichiestaTelefonica): string | null {
  if (r.tipo !== "domicilio" || typeof r.nomeCitofono !== "string") return null;
  return r.nomeCitofono.trim().slice(0, 80) || null;
}

// Stesso criterio dell'app: 1,50 € di consegna (solo domicilio) sopra i prodotti, meno gli sconti (che toccano solo i prodotti).
export function totaliTelefonici(tipo: "domicilio" | "asporto", totaleProdotti: number, scontoFedelta = 0, scontoCodice = 0) {
  const costoConsegna = tipo === "domicilio" ? COSTO_CONSEGNA_DEFAULT : 0;
  const totale = Math.round((totaleProdotti + costoConsegna - scontoFedelta - scontoCodice) * 100) / 100;
  return { totaleProdotti, costoConsegna, scontoFedelta, scontoCodice, totale };
}

// «Via Monte Bove, 24, 65124 Pescara PE» → «Via Monte Bove 24, Pescara»: la forma da dire a voce.
export function indirizzoParlato(indirizzo: string | null | undefined): string | null {
  const pulito = senzaItalia(indirizzo);
  if (!pulito) return null;
  return pulito
    .replace(/\b\d{5}\b/g, "") // CAP
    .replace(/\s+[A-Z]{2}\s*$/, "") // sigla della provincia
    .replace(/,\s*(\d+[A-Za-z]?(?:\/\d+)?)\s*,/, " $1,") // «Via X, 24, » → «Via X 24, »
    .replace(/\s{2,}/g, " ")
    .replace(/\s*,\s*$/, "")
    .trim();
}

// Google aggiunge ", Italy" in coda: sullo scontrino e a voce è solo rumore.
export const senzaItalia = (indirizzo: string | null | undefined) =>
  indirizzo ? indirizzo.replace(/,\s*(Italy|Italia)\s*$/i, "") : null;
