import twilio from "twilio";

// SMS "liberi" (conferma/rifiuto/spostamento ordine) via Twilio Messaging.
// Distinti dall'OTP, che usa Twilio Verify. Richiede un mittente in
// TWILIO_SMS_FROM (nome alfanumerico o numero Twilio).
// Best-effort: un SMS non partito non deve mai far fallire l'operazione che
// l'ha generato (l'ordine è già salvato); si restituisce solo l'esito.
export async function inviaSms(telefono: string, testo: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM;
  if (!sid || !token || !from) {
    console.warn("SMS non inviato: credenziali Twilio o TWILIO_SMS_FROM non configurati");
    return false;
  }
  try {
    await twilio(sid, token).messages.create({ from, to: telefono, body: testo });
    return true;
  } catch (err) {
    console.error("Invio SMS fallito", err);
    return false;
  }
}
