"use client";

import { useEffect } from "react";
import { pluginPushNativo } from "./Notifiche";

// Dentro l'app Android/iOS: quando il cliente tocca una notifica, apre la pagina indicata (di solito il suo ordine).
// Accetta solo indirizzi interni all'app ordini, mai siti esterni.
export default function PushNativoTocco() {
  useEffect(() => {
    const plugin = pluginPushNativo();
    if (!plugin) return;
    let ascoltatore: any = null;
    let attivo = true;
    (async () => {
      try {
        const a = await plugin.addListener("pushNotificationActionPerformed", (azione: any) => {
          const url = azione?.notification?.data?.url;
          if (typeof url === "string" && /^\/ordina(\/|\?|#|$)/.test(url)) window.location.href = url;
        });
        if (attivo) ascoltatore = a; else a?.remove?.();
      } catch {}
    })();
    return () => { attivo = false; try { ascoltatore?.remove?.(); } catch {} };
  }, []);
  return null;
}
