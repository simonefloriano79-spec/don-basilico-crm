import type { PrintOrdine } from "@/lib/print";

// Ora o "domani HH:MM" nel fuso italiano, come mostrato sugli scontrini.
function quando(d: string): string {
  const dt = new Date(d);
  const giorno = (x: Date) => x.toLocaleDateString("it-IT", { timeZone: "Europe/Rome" });
  const ora = dt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
  const oggi = new Date();
  if (giorno(dt) === giorno(oggi)) return ora;
  if (giorno(dt) === giorno(new Date(oggi.getTime() + 86400000))) return `domani ${ora}`;
  return `${dt.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", timeZone: "Europe/Rome" })} ${ora}`;
}

// Nome da mostrare nelle liste: il tavolo ha la precedenza.
export function nomeOrdine(o: any): string {
  const nome = o.clienteNome && o.clienteNome !== "Cliente anonimo" ? o.clienteNome : "";
  if (o.tavolo) return `Tavolo ${o.tavolo}${nome && nome !== `Tavolo ${o.tavolo}` ? ` · ${nome}` : ""}`;
  return nome || "Anonimo";
}

// Ordine come lo restituisce l'API → dati per lo scontrino/comanda.
export function ordineApiPerStampa(o: any): PrintOrdine {
  return {
    numero: o.numeroOrdine,
    ordineId: o.id,
    sede: o.sede?.nome ?? "",
    canale: o.canale,
    tipo: o.tipo,
    cliente: nomeOrdine(o),
    telefono: o.clienteTelefono ?? undefined,
    indirizzo: o.clienteIndirizzo ?? undefined,
    nomeCitofono: o.nomeCitofono ?? undefined,
    tavolo: o.tavolo ?? undefined,
    items: (o.items ?? []).map((i: any) => ({
      nome: i.nomeSnapshot, qty: i.quantita, prezzo: parseFloat(i.prezzoSnapshot), note: i.noteItem ?? undefined,
    })),
    totale: parseFloat(o.totale),
    costoConsegna: parseFloat(o.costoConsegna ?? 0) || undefined,
    scontoFedelta: parseFloat(o.scontoFedelta ?? 0) || undefined,
    modificato: o.canale === "online" && !!o.modificatoAt ? true : undefined,
    note: o.note ?? undefined,
    noteDomicilio: o.noteDomicilio ?? undefined,
    oraConsegnaComunicata: o.oraConsegnaComunicata ? quando(o.oraConsegnaComunicata) : undefined,
    modalitaConsegna: o.modalitaConsegna ?? undefined,
    metodoPagamento: o.metodoPagamento ?? undefined,
    ora: new Date(o.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }),
  };
}
