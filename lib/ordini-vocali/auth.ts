import { NextRequest } from "next/server";

// Le route di questo modulo non hanno una sessione NextAuth (chi chiama è
// Vapi/Retell, non uno staff loggato): si verificano con un segreto condiviso
// nell'header, configurato lato piattaforma voce come header custom.
export function verificaSegretoWebhook(req: NextRequest): boolean {
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-voice-webhook-secret");
  return header === secret;
}
