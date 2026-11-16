import { createPrivateKey, sign } from "crypto";
import http2 from "http2";
import type { EsitoNativo, MessaggioNativo } from "@/lib/push-nativo";

// Invio delle notifiche all'app iPhone direttamente ad Apple (APNs, HTTP/2 con chiave .p8).
// Sull'iPhone il plugin dell'app restituisce il token di Apple (non quello di Firebase), quindi per i token con
// piattaforma «ios» si passa da qui. Android continua a usare Firebase (lib/push-nativo.ts).
//
// Variabili su Vercel (tutte necessarie, altrimenti l'invio iPhone resta spento e non cambia nulla per gli altri):
//   APNS_KEY       contenuto del file .p8 scaricato da Apple (anche in base64)
//   APNS_KEY_ID    identificativo della chiave (10 caratteri)
//   APNS_TEAM_ID   Team ID dell'account Apple Developer (10 caratteri)
// Facoltative:
//   APNS_BUNDLE_ID  default it.donbasilico.ordina
//   APNS_SANDBOX    "1" per provare un'app compilata e lanciata da Xcode (le app TestFlight/App Store usano il server di produzione)

interface ConfigApns {
  chiave: string;
  keyId: string;
  teamId: string;
  bundleId: string;
  sandbox: boolean;
}

let config: ConfigApns | null | undefined;
function leggiConfig(): ConfigApns | null {
  if (config !== undefined) return config;
  config = null;
  const grezza = process.env.APNS_KEY?.trim();
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  if (!grezza || !keyId || !teamId) return config;
  try {
    const testo = grezza.includes("BEGIN") ? grezza : Buffer.from(grezza, "base64").toString("utf8");
    const chiave = testo.replace(/\\n/g, "\n");
    createPrivateKey(chiave); // controlla subito che la chiave sia leggibile
    config = {
      chiave,
      keyId,
      teamId,
      bundleId: process.env.APNS_BUNDLE_ID?.trim() || "it.donbasilico.ordina",
      sandbox: process.env.APNS_SANDBOX === "1",
    };
  } catch {
    console.error("APNS_KEY non valida");
  }
  return config;
}

export function pushApnsAttivo(): boolean {
  return leggiConfig() !== null;
}

const b64url = (v: Buffer | string) => Buffer.from(v).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

// Apple vuole un token firmato (ES256) riusato per 20-60 minuti: ne rifare uno a ogni invio viene rifiutato.
let jwt: { valore: string; creato: number } | null = null;
function tokenProvider(c: ConfigApns): string {
  const ora = Math.floor(Date.now() / 1000);
  if (jwt && ora - jwt.creato < 40 * 60) return jwt.valore;
  const intestazione = b64url(JSON.stringify({ alg: "ES256", kid: c.keyId }));
  const corpo = b64url(JSON.stringify({ iss: c.teamId, iat: ora }));
  const firma = sign("sha256", Buffer.from(`${intestazione}.${corpo}`), { key: c.chiave, dsaEncoding: "ieee-p1363" });
  jwt = { valore: `${intestazione}.${corpo}.${b64url(firma)}`, creato: ora };
  return jwt.valore;
}

interface RispostaApns {
  stato: number;
  motivo: string;
}

function postHttp2(host: string, percorso: string, intestazioni: Record<string, string>, corpo: string): Promise<RispostaApns> {
  return new Promise((risolvi) => {
    const client = http2.connect(`https://${host}`);
    let chiuso = false;
    const fine = (r: RispostaApns) => {
      if (chiuso) return;
      chiuso = true;
      clearTimeout(timer);
      try { client.close(); } catch {}
      risolvi(r);
    };
    const timer = setTimeout(() => { try { client.destroy(); } catch {} fine({ stato: 0, motivo: "timeout" }); }, 10000);
    client.on("error", () => fine({ stato: 0, motivo: "errore di rete" }));
    try {
      const req = client.request({ ":method": "POST", ":path": percorso, ...intestazioni });
      let stato = 0;
      let testo = "";
      req.setEncoding("utf8");
      req.on("response", (h) => { stato = Number(h[":status"]) || 0; });
      req.on("data", (d) => { testo += d; });
      req.on("end", () => {
        let motivo = "";
        try { motivo = String(JSON.parse(testo || "{}")?.reason ?? ""); } catch {}
        fine({ stato, motivo });
      });
      req.on("error", () => fine({ stato: 0, motivo: "errore di rete" }));
      req.end(corpo);
    } catch {
      fine({ stato: 0, motivo: "errore di rete" });
    }
  });
}

// Invia a un singolo iPhone. "token-scaduto" = l'app non c'è più su quel telefono: il token va tolto.
export async function inviaPushApns(token: string, m: MessaggioNativo): Promise<EsitoNativo> {
  const c = leggiConfig();
  if (!c) return "errore";
  try {
    const host = c.sandbox ? "api.sandbox.push.apple.com" : "api.push.apple.com";
    const tag = m.tag ? Buffer.from(m.tag).subarray(0, 64).toString() : undefined;
    const intestazioni: Record<string, string> = {
      authorization: `bearer ${tokenProvider(c)}`,
      "apns-topic": c.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": String(Math.floor(Date.now() / 1000) + 6 * 3600),
      "content-type": "application/json",
    };
    if (tag) intestazioni["apns-collapse-id"] = tag;
    const corpo = JSON.stringify({
      aps: { alert: { title: m.titolo, body: m.testo }, sound: "default", ...(tag ? { "thread-id": tag } : {}) },
      url: m.url ?? "/ordina",
    });
    const r = await postHttp2(host, `/3/device/${token}`, intestazioni, corpo);
    if (r.stato === 200) return "ok";
    if (r.stato === 410 || (r.stato === 400 && /^(BadDeviceToken|DeviceTokenNotForTopic)$/.test(r.motivo))) return "token-scaduto";
    if (r.stato === 403) jwt = null; // chiave o Team ID sbagliati: al prossimo invio si rifà il token
    console.warn("Push iPhone non inviata", r.stato, r.motivo);
    return "errore";
  } catch (err) {
    console.warn("Push iPhone: errore", err);
    return "errore";
  }
}
