import twilio from "twilio";
import type { ArticoloPrezzato } from "./pricing";

let client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error("Credenziali Twilio non configurate");
    client = twilio(sid, token);
  }
  return client;
}

interface RiepilogoOrdine {
  numeroOrdine: number;
  sedeNome: string;
  clienteNome: string;
  clienteTelefono: string;
  tipo: "domicilio" | "asporto";
  clienteIndirizzo?: string | null;
  nomeCitofono?: string | null;
  metodoPagamento?: "contanti" | "pos" | null;
  oraRichiesta?: Date | null; // solo se il cliente ha chiesto un orario preciso
  articoli: ArticoloPrezzato[];
  costoConsegna: number;
  scontoFedelta?: number;
  scontoCodice?: number;
  totale: number;
  note?: string | null;
}

const ORA = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });

function formattaRiepilogo(o: RiepilogoOrdine): string {
  const righe = o.articoli
    .map((a) => {
      const taglia = a.taglia === "maxi" ? " (MAXI)" : "";
      const dettagli = [
        a.combo?.dettaglio ?? "",
        a.impasto ? `impasto ${a.impasto.nome}` : "",
        a.rimossi.length ? `SENZA ${a.rimossi.map((r) => r.nome).join(", ")}` : "",
        a.extra.length ? `CON ${a.extra.map((e) => e.nome).join(", ")}` : "",
        a.note ?? "",
      ].filter(Boolean);
      return `• ${a.quantita}x ${a.nomeSnapshot}${taglia}${dettagli.length ? ` (${dettagli.join(" | ")})` : ""}`;
    })
    .join("\n");

  return [
    `🍕 Nuovo ordine telefonico #${o.numeroOrdine} — ${o.sedeNome} (DA ACCETTARE nella pagina Ordini)`,
    `Cliente: ${o.clienteNome} (${o.clienteTelefono})`,
    o.tipo === "domicilio" ? `Consegna: ${o.clienteIndirizzo}` : "Ritiro in sede",
    o.nomeCitofono ? `Citofono: ${o.nomeCitofono}` : "",
    o.oraRichiesta ? `${o.tipo === "domicilio" ? "Non prima delle" : "Ritiro alle"} ${ORA.format(o.oraRichiesta)}` : "",
    "",
    righe,
    "",
    o.costoConsegna > 0 ? `Consegna: €${o.costoConsegna.toFixed(2)}` : "",
    o.scontoFedelta ? `Sconto fedeltà: -€${o.scontoFedelta.toFixed(2)}` : "",
    o.scontoCodice ? `Codice sconto: -€${o.scontoCodice.toFixed(2)}` : "",
    `Totale: €${o.totale.toFixed(2)}${o.metodoPagamento ? ` — paga ${o.metodoPagamento === "pos" ? "con POS" : "in contanti"}` : ""}`,
    o.note ? `Note: ${o.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// Invio best-effort: un fallimento qui non deve mai far fallire la conferma
// dell'ordine, che è già stato salvato — l'operatore lo vede comunque sullo
// schermo cassa. Prova WhatsApp Business, poi SMS come fallback.
export async function notificaSede(sedeTelefono: string | null, dati: RiepilogoOrdine): Promise<void> {
  if (!sedeTelefono) {
    console.error(`notificaSede: nessun numero di telefono configurato per la sede ${dati.sedeNome}`);
    return;
  }

  const body = formattaRiepilogo(dati);
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

  if (whatsappFrom) {
    try {
      await getClient().messages.create({ from: whatsappFrom, to: `whatsapp:${sedeTelefono}`, body });
      return;
    } catch (err) {
      console.error("Notifica WhatsApp sede fallita, provo SMS", err);
    }
  }

  const smsFrom = process.env.TWILIO_PHONE_NUMBER;
  if (smsFrom) {
    try {
      await getClient().messages.create({ from: smsFrom, to: sedeTelefono, body });
    } catch (err) {
      console.error("Fallback SMS sede fallito", err);
    }
  }
}
