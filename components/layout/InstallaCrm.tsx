"use client";

import { useEffect, useState } from "react";

// Installazione del CRM come app (telefono e computer): icona baffo verde + «CRM», si apre in una finestra tutta sua.
// Va usato in un componente sempre presente: il browser manda l'evento di installazione una volta sola, subito dopo il caricamento.
export function useInstallaCrm() {
  const [evento, setEvento] = useState<any>(null);
  const [installata, setInstallata] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    // Già aperto dall'icona: non serve nessun pulsante.
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true) {
      setInstallata(true);
      return;
    }
    const ua = navigator.userAgent;
    setIos(/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    const prima = (e: Event) => { e.preventDefault(); setEvento(e); };
    const fatto = () => { setInstallata(true); setEvento(null); };
    window.addEventListener("beforeinstallprompt", prima);
    window.addEventListener("appinstalled", fatto);
    // Senza service worker alcuni browser non offrono l'installazione.
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw-crm.js", { scope: "/" }).catch(() => {});
    return () => { window.removeEventListener("beforeinstallprompt", prima); window.removeEventListener("appinstalled", fatto); };
  }, []);

  const installa = async () => {
    if (!evento) return false;
    evento.prompt();
    try {
      const scelta = await evento.userChoice;
      if (scelta?.outcome === "accepted") setInstallata(true);
    } catch {}
    setEvento(null);
    return true;
  };

  return { pronto: !!evento, installata, ios, installa };
}

export function PulsanteInstallaCrm({ stato, dispositivo = "telefono" }: { stato: ReturnType<typeof useInstallaCrm>; dispositivo?: "telefono" | "computer" }) {
  const [istruzioni, setIstruzioni] = useState(false);
  if (stato.installata) return null;
  const pc = dispositivo === "computer";

  const tocca = async () => {
    // Chrome/Edge: parte direttamente l'installazione. Altrimenti (iPhone, Safari, Firefox…) si mostrano i passaggi.
    if (stato.pronto && (await stato.installa())) return;
    setIstruzioni((v) => !v);
  };

  const passi = pc ? (
    <>
      <li>Apri il CRM con <strong>Chrome</strong> o <strong>Edge</strong></li>
      <li>Nella barra dell&apos;indirizzo, a destra, clicca l&apos;icona di <strong>installazione</strong> (un monitor con una freccia). Se non c&apos;è: menu <strong>⋮</strong> → <strong>Trasmetti, salva e condividi</strong> → <strong>Installa pagina come app</strong></li>
      <li>Conferma: l&apos;icona <strong>CRM</strong> compare tra le app del PC (anche sul desktop e nel menu Start)</li>
    </>
  ) : stato.ios ? (
    <>
      <li>Apri questa pagina da <strong>Safari</strong></li>
      <li>Tocca <strong>Condividi</strong> (il quadrato con la freccia verso l&apos;alto)</li>
      <li>Scegli <strong>«Aggiungi alla schermata Home»</strong>, poi <strong>«Aggiungi»</strong></li>
    </>
  ) : (
    <>
      <li>Tocca i tre puntini <strong>⋮</strong> in alto nel browser (Chrome)</li>
      <li>Scegli <strong>Installa app</strong> o <strong>Aggiungi a schermata Home</strong></li>
      <li>Conferma: trovi l&apos;icona <strong>CRM</strong> tra le tue app</li>
    </>
  );

  return (
    <div style={{ marginBottom: pc ? 8 : 10 }}>
      <button
        type="button"
        onClick={tocca}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: pc ? 10 : 12, padding: pc ? "8px 10px" : "10px 14px",
          borderRadius: pc ? 10 : 12, border: "none", background: "var(--text)", color: "#fff", cursor: "pointer", textAlign: "left",
          fontFamily: "var(--font-ui)", fontSize: pc ? 12.5 : 14, fontWeight: 600,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/crm-icons/icon-192.png" alt="" width={pc ? 30 : 36} height={pc ? 30 : 36} style={{ borderRadius: pc ? 8 : 9, flexShrink: 0 }} />
        <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span>{pc ? "Installa il CRM sul computer" : "Installa il CRM sul telefono"}</span>
          <span style={{ fontSize: pc ? 10.5 : 11.5, fontWeight: 400, opacity: 0.75 }}>
            {pc ? "Si apre da solo, come un'app" : "Icona «CRM» in home, si apre a schermo intero"}
          </span>
        </span>
      </button>
      {istruzioni && (
        <ol style={{ margin: "8px 0 0", padding: "10px 12px 10px 28px", border: "1px solid var(--border)", borderRadius: 10, background: "#fff", fontSize: pc ? 11.5 : 13, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 4, color: "var(--text)" }}>
          {passi}
        </ol>
      )}
    </div>
  );
}
