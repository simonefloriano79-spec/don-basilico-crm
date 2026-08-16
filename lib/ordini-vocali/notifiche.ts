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
  articoli: ArticoloPrezzato[];
  totale: number;
  note?: string | null;
}

function formattaRiepilogo(o: RiepilogoOrdine): string {
  const righe = o.articoli
    .map((a) => {
      const taglia = a.taglia === "maxi" ? " (MAXI)" : "";
      const extra = a.extra.length ? ` +${a.extra.map((e) => e.nome).join(", +")}` : "";
      return `• ${a.quantita}x ${a.nomeSnapshot}${taglia}${extra}`;
    })
    .join("\n");

  return [
    `🍕 Nuovo ordine vocale #${o.numeroOrdine} — ${o.sedeNome}`,
    `Cliente: ${o.clienteNome} (${o.clienteTelefono})`,
    o.tipo === "domicilio" ? `Consegna: ${o.clienteIndirizzo}` : "Ritiro in sede",
    "",
    righe,
    "",
    `Totale: €${o.totale.toFixed(2)}`,
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
