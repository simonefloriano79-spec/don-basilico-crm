import webpush from "web-push";
import { prisma } from "@/lib/prisma";

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

// Invia la notifica a tutti i telefoni iscritti del cliente. Restituisce quanti l'hanno accettata.
export async function inviaPushCliente(clienteId: string | null | undefined, n: NotificaPush): Promise<number> {
  if (!clienteId || !configura()) return 0;
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
