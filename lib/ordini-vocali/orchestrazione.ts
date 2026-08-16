import { prisma } from "@/lib/prisma";
import { geocodificaIndirizzo, trovaSedeCompetente } from "./copertura";
import { verificaSedeDisponibile } from "./capacita";
import { calcolaOrdine, ArticoloOrdinatoInput, ArticoloPrezzato, ErrorePricing } from "./pricing";

export interface RichiestaOrdine {
  clienteNome: string;
  clienteTelefono: string;
  tipo: "domicilio" | "asporto";
  clienteIndirizzo?: string; // richiesto se tipo = domicilio
  sedeSlugAsporto?: string; // richiesto se tipo = asporto (slug tra i 6 noti, es. "chieti-scalo")
  articoli: ArticoloOrdinatoInput[];
  note?: string;
  oraRichiesta?: string; // ISO 8601, opzionale (default: adesso)
}

export type EsitoOrchestrazione =
  | {
      ok: true;
      sedeId: string;
      sedeNome: string;
      totale: number;
      articoli: ArticoloPrezzato[];
      indirizzoLat?: number;
      indirizzoLng?: number;
      indirizzoFormattato?: string;
      oraRichiesta: Date;
    }
  | {
      ok: false;
      esito: "fuori_zona" | "cucina_piena" | "chiuso" | "errore";
      motivo: string;
      sedeId?: string;
    };

// Orchestrazione condivisa da prepara_ordine e conferma_ordine: stesso identico
// calcolo per il "preventivo" e per il salvataggio finale, per evitare che il
// totale detto al cliente e quello salvato possano mai divergere.
export async function elaboraRichiestaOrdine(input: RichiestaOrdine): Promise<EsitoOrchestrazione> {
  const oraRichiesta = input.oraRichiesta ? new Date(input.oraRichiesta) : new Date();
  if (Number.isNaN(oraRichiesta.getTime())) {
    return { ok: false, esito: "errore", motivo: "oraRichiesta non valida" };
  }

  let sedeId: string;
  let sedeNome: string;
  let indirizzoLat: number | undefined;
  let indirizzoLng: number | undefined;
  let indirizzoFormattato: string | undefined;

  if (input.tipo === "domicilio") {
    if (!input.clienteIndirizzo) {
      return { ok: false, esito: "errore", motivo: "Indirizzo mancante per una consegna a domicilio" };
    }

    const geo = await geocodificaIndirizzo(input.clienteIndirizzo);
    if (!geo) {
      return {
        ok: false,
        esito: "errore",
        motivo: "Indirizzo non riconosciuto: chiedi al cliente di ripeterlo con più dettagli (via, numero civico, città)",
      };
    }

    const sede = await trovaSedeCompetente(geo.lat, geo.lng);
    if (!sede) {
      return { ok: false, esito: "fuori_zona", motivo: "L'indirizzo è fuori dalla zona di consegna di tutte le sedi" };
    }

    sedeId = sede.sedeId;
    sedeNome = sede.nome;
    indirizzoLat = geo.lat;
    indirizzoLng = geo.lng;
    indirizzoFormattato = geo.indirizzoFormattato;
  } else {
    if (!input.sedeSlugAsporto) {
      return { ok: false, esito: "errore", motivo: "Per l'asporto serve sapere presso quale sede il cliente vuole ritirare" };
    }

    const sede = await prisma.sede.findUnique({ where: { slug: input.sedeSlugAsporto } });
    if (!sede || !sede.attiva) {
      return { ok: false, esito: "chiuso", motivo: "Sede non trovata o non attiva" };
    }

    sedeId = sede.id;
    sedeNome = sede.nome;
  }

  const disponibilita = await verificaSedeDisponibile(sedeId, oraRichiesta);
  if (!disponibilita.ok) {
    const esito = disponibilita.motivo?.toLowerCase().includes("chius") ? "chiuso" : "cucina_piena";
    return { ok: false, esito, motivo: disponibilita.motivo ?? "Sede non disponibile in questo orario", sedeId };
  }

  try {
    const { articoli, totale } = await calcolaOrdine(sedeId, input.articoli);
    return { ok: true, sedeId, sedeNome, totale, articoli, indirizzoLat, indirizzoLng, indirizzoFormattato, oraRichiesta };
  } catch (e) {
    if (e instanceof ErrorePricing) {
      return { ok: false, esito: "errore", motivo: e.message, sedeId };
    }
    throw e;
  }
}
