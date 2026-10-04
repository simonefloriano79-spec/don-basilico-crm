import twilio from "twilio";

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

export async function inviaCodiceOtp(telefono: string): Promise<void> {
  await getClient().verify.v2
    .services(getServiceSid())
    .verifications.create({ to: telefono, channel: "sms" });
}

export async function verificaCodiceOtp(telefono: string, codice: string): Promise<boolean> {
  const check = await getClient().verify.v2
    .services(getServiceSid())
    .verificationChecks.create({ to: telefono, code: codice });
  return check.status === "approved";
}
