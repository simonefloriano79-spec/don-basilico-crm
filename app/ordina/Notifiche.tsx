"use client";

import { useEffect, useState } from "react";
import { inAppNativa } from "@/lib/app-nativa";

// Notifiche push dell'app ordini: «ordine confermato», «nuovo orario», «ordine pronto».
// Si attivano solo con un tocco del cliente (lo richiedono i telefoni). Su iPhone funzionano solo se l'app è stata
// aggiunta alla schermata Home; su Android anche dal browser.

function aBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Il service worker è registrato con scope /ordina: sulla home pubblica (indirizzo «/») `serviceWorker.ready` non si
// sbloccherebbe mai, quindi si aspetta direttamente l'attivazione della registrazione.
async function registrazioneAttiva(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register("/sw-ordina.js", { scope: "/ordina" });
  if (reg.active) return reg;
  const sw = reg.installing || reg.waiting;
  if (!sw) return reg;
  await new Promise<void>((ok) => {
    if (sw.state === "activated") return ok();
    sw.addEventListener("statechange", () => { if (sw.state === "activated") ok(); });
    setTimeout(ok, 8000);
  });
  return reg;
}

async function inviaIscrizione(sub: PushSubscription): Promise<boolean> {
  try {
    const r = await fetch("/api/ordina/push", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export function infoDispositivo() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installata = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true || inAppNativa());
  return { ios, installata };
}

type Stato = "attesa" | "non-supportate" | "serve-installazione" | "da-attivare" | "attive" | "bloccate" | "errore";

export default function BoxNotifiche({ compatto = false }: { compatto?: boolean }) {
  const [stato, setStato] = useState<Stato>("attesa");
  const [occupato, setOccupato] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { ios, installata } = infoDispositivo();
      const supportate = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supportate) { if (vivo) setStato(ios && !installata ? "serve-installazione" : "non-supportate"); return; }
      if (Notification.permission === "denied") { if (vivo) setStato("bloccate"); return; }
      if (Notification.permission === "granted") {
        // Già concesse: si riallinea l'iscrizione al cliente collegato adesso (ad esempio dopo un nuovo accesso).
        try {
          const reg = await registrazioneAttiva();
          const sub = await reg.pushManager.getSubscription();
          if (sub && (await inviaIscrizione(sub))) { if (vivo) setStato("attive"); return; }
        } catch {}
      }
      if (vivo) setStato("da-attivare");
    })();
    return () => { vivo = false; };
  }, []);

  const attiva = async () => {
    setOccupato(true);
    try {
      const permesso = await Notification.requestPermission();
      if (permesso !== "granted") { setStato(permesso === "denied" ? "bloccate" : "da-attivare"); return; }
      const chiave = (await fetch("/api/ordina/push/chiave").then((r) => r.json()).catch(() => ({}))).chiave as string | undefined;
      if (!chiave) { setStato("errore"); return; }
      const reg = await registrazioneAttiva();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(chiave) }));
      setStato((await inviaIscrizione(sub)) ? "attive" : "errore");
    } catch {
      setStato("errore");
    } finally {
      setOccupato(false);
    }
  };

  const scheda: React.CSSProperties = {
    background: "var(--accent-bg-2)", border: "1px solid var(--accent-border)", borderRadius: 16,
    padding: compatto ? "12px 14px" : "14px 16px", textAlign: "left", display: "flex", gap: 12, alignItems: "flex-start",
  };
  const icona = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
  const titolo: React.CSSProperties = { fontSize: 14.5, fontWeight: 700, color: "var(--text)" };
  const testo: React.CSSProperties = { fontSize: 13, lineHeight: 1.45, color: "var(--text-2)", marginTop: 2 };

  if (stato === "attesa" || stato === "non-supportate") return null;

  if (stato === "attive") {
    return (
      <div style={{ ...scheda, alignItems: "center" }}>
        {icona}
        <div style={{ fontSize: 13.5, color: "var(--text)" }}><strong>Notifiche attive</strong> · ti avvisiamo quando l'ordine è confermato e pronto.</div>
      </div>
    );
  }

  if (stato === "serve-installazione") {
    return (
      <div style={scheda}>
        {icona}
        <div>
          <div style={titolo}>Vuoi le notifiche sull'iPhone?</div>
          <div style={testo}>Aggiungi prima l'app alla schermata Home, poi apri l'app dall'icona: ti spieghiamo come <a href="/ordina/app" style={{ color: "var(--accent-ink)", textDecoration: "underline" }}>in questa pagina</a>.</div>
        </div>
      </div>
    );
  }

  if (stato === "bloccate") {
    return (
      <div style={scheda}>
        {icona}
        <div>
          <div style={titolo}>Notifiche disattivate</div>
          <div style={testo}>Le hai bloccate nelle impostazioni del telefono. Per riceverle, riattivale da lì per Don Basilico.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={scheda}>
      {icona}
      <div style={{ flex: 1 }}>
        <div style={titolo}>Ricevi un avviso sul telefono</div>
        <div style={testo}>Ti diciamo quando la pizzeria conferma l'ordine, se cambia l'orario e quando è pronto. Gli SMS continuano ad arrivare.</div>
        {stato === "errore" && <div role="alert" style={{ ...testo, color: "#B3261E" }}>Non siamo riusciti ad attivarle. Riprova tra poco.</div>}
        <button type="button" onClick={attiva} disabled={occupato} style={{
          marginTop: 10, minHeight: 44, padding: "0 18px", borderRadius: 22, border: "none", background: "var(--text)", color: "#fff",
          fontSize: 14.5, fontWeight: 600, cursor: occupato ? "default" : "pointer", opacity: occupato ? 0.6 : 1,
        }}>{occupato ? "Un attimo…" : "Attiva le notifiche"}</button>
      </div>
    </div>
  );
}
