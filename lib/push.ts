import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { inviaPushNativo, pushNativoAttivo } from "@/lib/push-nativo";
import { inviaPushApns, pushApnsAttivo } from "@/lib/push-apns";

// Notifiche push per i clienti dell'app ordini (affiancano gli SMS, non li sostituiscono).
// Servono 3 variabili su Vercel: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...).
// Best-effort come gli SMS: una notifica non partita non deve mai far fallire l'operazione che l'ha generata.

// Solo i servizi push veri dei browser: l'indirizzo arriva dal telefono del cliente, quindi non va mai
// chiamato un indirizzo qualsiasi (altrimenti il server potrebbe essere usato per colpire altri siti).
const HOST_PUSH_AMMESSI = [
  /(^|\.)fcm\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

export function endpointPushValido(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 600) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && HOST_PUSH_AMMESSI.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
}

export function chiavePubblicaPush(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

let configurato = false;
function configura(): boolean {
  if (configurato) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:pitta.donbasilico@gmail.com", pub, priv);
  configurato = true;
  return true;
}

export interface NotificaPush {
  titolo: string;
  testo: string;
  url?: string; // dove porta il tocco sulla notifica (default: l'app ordini)
  tag?: string; // notifiche con lo stesso tag si sostituiscono (es. un solo avviso per ordine)
}

// Invia la notifica a tutti i telefoni iscritti del cliente (browser/app installata e app nativa).
// Restituisce quanti l'hanno accettata.
export async function inviaPushCliente(clienteId: string | null | undefined, n: NotificaPush): Promise<number> {
  if (!clienteId) return 0;
  const [web, nativi] = await Promise.all([inviaPushWeb(clienteId, n), inviaPushNativiCliente(clienteId, n)]);
  return web + nativi;
}

// App nativa: un token per ogni telefono. Android passa da Firebase, iPhone direttamente da Apple (APNs):
// ogni strada resta spenta finché mancano le sue variabili su Vercel.
async function inviaPushNativiCliente(clienteId: string, n: NotificaPush): Promise<number> {
  const fcmAttivo = pushNativoAttivo();
  const apnsAttivo = pushApnsAttivo();
  if (!fcmAttivo && !apnsAttivo) return 0;
  try {
    const token = await prisma.pushTokenNativo.findMany({ where: { clienteId }, select: { id: true, token: true, piattaforma: true } });
    if (!token.length) return 0;
    let ok = 0;
    const scaduti: string[] = [];
    await Promise.all(
      token.map(async (t) => {
        const ios = t.piattaforma === "ios";
        if (ios ? !apnsAttivo : !fcmAttivo) return;
        const messaggio = { titolo: n.titolo, testo: n.testo, url: n.url, tag: n.tag };
        const esito = ios ? await inviaPushApns(t.token, messaggio) : await inviaPushNativo(t.token, messaggio);
        if (esito === "ok") ok++;
        else if (esito === "token-scaduto") scaduti.push(t.id);
      })
    );
    if (scaduti.length) await prisma.pushTokenNativo.deleteMany({ where: { id: { in: scaduti } } }).catch(() => {});
    return ok;
  } catch (err) {
    console.error("Errore invio push native", err);
    return 0;
  }
}

async function inviaPushWeb(clienteId: string, n: NotificaPush): Promise<number> {
  if (!configura()) return 0;
  try {
    const iscrizioni = await prisma.pushIscrizione.findMany({ where: { clienteId } });
    if (!iscrizioni.length) return 0;
    const payload = JSON.stringify({ titolo: n.titolo, testo: n.testo, url: n.url ?? "/ordina", tag: n.tag });
    let ok = 0;
    const scadute: string[] = [];
    await Promise.all(
      iscrizioni.map(async (i) => {
        try {
          await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, payload, { TTL: 60 * 60 * 6 });
          ok++;
        } catch (err: any) {
          // 404/410: il telefono ha disattivato le notifiche o disinstallato l'app → iscrizione da togliere.
          if (err?.statusCode === 404 || err?.statusCode === 410) scadute.push(i.id);
          else console.warn("Push non inviata", err?.statusCode, err?.body?.slice?.(0, 120));
        }
      })
    );
    if (scadute.length) await prisma.pushIscrizione.deleteMany({ where: { id: { in: scadute } } }).catch(() => {});
    return ok;
  } catch (err) {
    console.error("Errore invio push", err);
    return 0;
  }
}
