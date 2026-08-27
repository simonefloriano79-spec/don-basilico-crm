import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

// Sessione cliente pubblica (app ordini), separata da NextAuth (staff):
// niente password, l'identità è il numero di telefono verificato via OTP.
// Cookie firmato HMAC, nessuna dipendenza nuova: { clienteId, exp } + firma.

export const CUSTOMER_SESSION_COOKIE = "db_cliente_sessione";
const DURATA_SESSIONE_MS = 90 * 24 * 60 * 60 * 1000; // 90 giorni

interface PayloadSessione {
  clienteId: string;
  exp: number;
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getSecret(): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (!secret) throw new Error("CUSTOMER_SESSION_SECRET non configurata");
  return secret;
}

function firma(payload: string): string {
  return base64url(createHmac("sha256", getSecret()).update(payload).digest());
}

export function creaTokenSessione(clienteId: string): string {
  const payload: PayloadSessione = { clienteId, exp: Date.now() + DURATA_SESSIONE_MS };
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)));
  return `${payloadB64}.${firma(payloadB64)}`;
}

export function verificaTokenSessione(token: string | undefined | null): { clienteId: string } | null {
  if (!token) return null;
  const [payloadB64, firmaRicevuta] = token.split(".");
  if (!payloadB64 || !firmaRicevuta) return null;

  const firmaAttesa = firma(payloadB64);
  const a = Buffer.from(firmaRicevuta);
  const b = Buffer.from(firmaAttesa);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload: PayloadSessione = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
    if (!payload.clienteId || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return { clienteId: payload.clienteId };
  } catch {
    return null;
  }
}

// Helper comodo per le route pubbliche: legge ed eventualmente valida il
// cookie di sessione direttamente dalla request.
export function clienteIdDaRichiesta(req: NextRequest): string | null {
  const token = req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  return verificaTokenSessione(token)?.clienteId ?? null;
}
