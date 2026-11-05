import { createSign } from "crypto";

// Invio delle notifiche all'app nativa (Android/iOS) tramite Firebase Cloud Messaging (API HTTP v1).
// Serve una variabile su Vercel: FIREBASE_SERVICE_ACCOUNT = contenuto del file JSON dell'account di servizio Firebase
// (anche in base64). Senza, l'invio nativo è semplicemente disattivato (restano le notifiche del browser).

interface AccountServizio {
  project_id: string;
  client_email: string;
  private_key: string;
}

let account: AccountServizio | null | undefined;
function leggiAccount(): AccountServizio | null {
  if (account !== undefined) return account;
  account = null;
  const grezzo = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!grezzo) return account;
  try {
    const testo = grezzo.startsWith("{") ? grezzo : Buffer.from(grezzo, "base64").toString("utf8");
    const j = JSON.parse(testo);
    if (j?.project_id && j?.client_email && j?.private_key) {
      account = { project_id: j.project_id, client_email: j.client_email, private_key: String(j.private_key).replace(/\\n/g, "\n") };
    }
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT non valido");
  }
  return account;
}

export function pushNativoAttivo(): boolean {
  return leggiAccount() !== null;
}

const b64url = (v: Buffer | string) => Buffer.from(v).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

let tokenAccesso: { valore: string; scade: number } | null = null;
async function accessToken(a: AccountServizio): Promise<string | null> {
  const ora = Math.floor(Date.now() / 1000);
  if (tokenAccesso && tokenAccesso.scade - 60 > ora) return tokenAccesso.valore;
  const intestazione = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = b64url(JSON.stringify({
    iss: a.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: ora,
    exp: ora + 3600,
  }));
  const firma = b64url(createSign("RSA-SHA256").update(`${intestazione}.${corpo}`).sign(a.private_key));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${intestazione}.${corpo}.${firma}` }),
  });
  if (!r.ok) {
    console.warn("Token Firebase non ottenuto", r.status);
    return null;
  }
  const j = await r.json().catch(() => null);
  if (!j?.access_token) return null;
  tokenAccesso = { valore: j.access_token, scade: ora + (Number(j.expires_in) || 3600) };
  return tokenAccesso.valore;
}

export interface MessaggioNativo {
  titolo: string;
  testo: string;
  url?: string;
  tag?: string;
}

export type EsitoNativo = "ok" | "token-scaduto" | "errore";

// Invia a un singolo telefono. "token-scaduto" = il telefono non esiste più (app disinstallata): il token va tolto.
export async function inviaPushNativo(token: string, m: MessaggioNativo): Promise<EsitoNativo> {
  const a = leggiAccount();
  if (!a) return "errore";
  try {
    const at = await accessToken(a);
    if (!at) return "errore";
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${a.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: m.titolo, body: m.testo },
          data: { url: m.url ?? "/ordina", ...(m.tag ? { tag: m.tag } : {}) },
          android: { priority: "HIGH", ttl: "21600s", notification: { ...(m.tag ? { tag: m.tag } : {}) } },
        },
      }),
    });
    if (r.ok) return "ok";
    const corpo = await r.text().catch(() => "");
    if (r.status === 404 || /UNREGISTERED|NOT_FOUND/.test(corpo)) return "token-scaduto";
    console.warn("Push nativa non inviata", r.status, corpo.slice(0, 160));
    return "errore";
  } catch (err) {
    console.warn("Push nativa: errore di rete", err);
    return "errore";
  }
}
