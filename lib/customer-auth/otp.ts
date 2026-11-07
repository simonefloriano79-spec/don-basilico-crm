import twilio from "twilio";
import { timingSafeEqual } from "crypto";
import { normalizzaTelefono } from "./telefono";

// OTP verifica telefono cliente via Twilio Verify: il servizio gestisce da
// solo generazione codice, scadenza e limite tentativi — non replichiamo
// questa logica a mano.

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

function getServiceSid(): string {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid) throw new Error("TWILIO_VERIFY_SERVICE_SID non configurata");
  return sid;
}

// Accesso di prova per i revisori di Google Play (e dell'App Store): non possono ricevere un SMS vero, quindi per UN SOLO
// numero scelto da noi il codice non parte e vale un codice fisso. Si attiva solo se su Vercel esistono entrambe le
// variabili DEMO_REVISORE_TELEFONO e DEMO_REVISORE_CODICE (almeno 6 caratteri); senza, tutto funziona come prima.
function codiceDemoRevisore(telefono: string): string | null {
  const num = process.env.DEMO_REVISORE_TELEFONO?.trim();
  const cod = process.env.DEMO_REVISORE_CODICE?.trim();
  if (!num || !cod || cod.length < 6) return null;
  return normalizzaTelefono(num) === telefono ? cod : null;
}

export async function inviaCodiceOtp(telefono: string): Promise<void> {
  if (codiceDemoRevisore(telefono)) return; // nessun SMS: il codice è quello fisso
  await getClient().verify.v2
    .services(getServiceSid())
    .verifications.create({ to: telefono, channel: "sms" });
}

export async function verificaCodiceOtp(telefono: string, codice: string): Promise<boolean> {
  const demo = codiceDemoRevisore(telefono);
  if (demo) {
    const a = Buffer.from(codice.trim());
    const b = Buffer.from(demo);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const check = await getClient().verify.v2
    .services(getServiceSid())
    .verificationChecks.create({ to: telefono, code: codice });
  return check.status === "approved";
}
