"use client";

import { useEffect, useState } from "react";

// Installazione del CRM sul telefono (icona baffo verde + «CRM»).
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

export function PulsanteInstallaCrm({ stato }: { stato: ReturnType<typeof useInstallaCrm> }) {
  const [istruzioni, setIstruzioni] = useState(false);
  if (stato.installata) return null;

  const tocca = async () => {
    // Android/Chrome: parte direttamente l'installazione. Altrimenti (iPhone, altri browser) si mostrano i passaggi.
    if (stato.pronto && (await stato.installa())) return;
    setIstruzioni((v) => !v);
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        type="button"
        onClick={tocca}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12,
          border: "none", background: "var(--text)", color: "#fff", cursor: "pointer", textAlign: "left",
          fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/crm-icons/icon-192.png" alt="" width={36} height={36} style={{ borderRadius: 9, flexShrink: 0 }} />
        <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span>Installa il CRM sul telefono</span>
          <span style={{ fontSize: 11.5, fontWeight: 400, opacity: 0.75 }}>Icona «CRM» in home, si apre a schermo intero</span>
        </span>
      </button>
      {istruzioni && (
        <ol style={{ margin: "8px 0 0", padding: "12px 14px 12px 32px", border: "1px solid var(--border)", borderRadius: 12, background: "#fff", fontSize: 13, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 4, color: "var(--text)" }}>
          {stato.ios ? (
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
          )}
        </ol>
      )}
    </div>
  );
}
