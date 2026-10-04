import twilio from "twilio";

// SMS "liberi" (conferma/rifiuto/spostamento ordine) via Twilio Messaging.
// Distinti dall'OTP, che usa Twilio Verify. Richiede un mittente in
// TWILIO_SMS_FROM (nome alfanumerico o numero Twilio).
// Best-effort: un SMS non partito non deve mai far fallire l'operazione che
// l'ha generato (l'ordine è già salvato); si restituisce solo l'esito.
export interface EsitoSms {
  ok: boolean;
  errore?: string; // motivo leggibile (codice Twilio incluso) quando ok è false, da mostrare nel CRM
  sid?: string; // identificativo del messaggio su Twilio (si cerca nei log di Twilio)
}

export async function inviaSmsDettaglio(telefono: string, testo: string): Promise<EsitoSms> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM;
  if (!sid || !token || !from) {
    const mancanti = [!sid && "TWILIO_ACCOUNT_SID", !token && "TWILIO_AUTH_TOKEN", !from && "TWILIO_SMS_FROM"].filter(Boolean).join(", ");
    console.warn(`SMS non inviato: variabili mancanti (${mancanti})`);
    return { ok: false, errore: `Variabili mancanti in Vercel: ${mancanti}` };
  }
  try {
    const m = await twilio(sid, token).messages.create({ from, to: telefono, body: testo });
    console.log(`SMS accettato da Twilio: ${m.sid} stato=${m.status}`);
    return { ok: true, sid: m.sid };
  } catch (err: any) {
    console.error("Invio SMS fallito", err);
    return { ok: false, errore: `${err?.code ? `Twilio ${err.code}: ` : ""}${err?.message ?? "errore sconosciuto"}`.slice(0, 220) };
  }
}

export async function inviaSms(telefono: string, testo: string): Promise<boolean> {
  return (await inviaSmsDettaglio(telefono, testo)).ok;
}
