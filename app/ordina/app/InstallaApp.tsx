"use client";

import { useEffect, useState } from "react";
import { inAppNativa } from "@/lib/app-nativa";

type Telefono = "android" | "ios" | "computer";

const VERDE = "#7ECE25";
const TESTO = "#1B1E17";
const BORDO = "#E4E5DD";

const ICONA_BOX: React.CSSProperties = { width: 44, height: 44, borderRadius: 14, background: TESTO, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" };
const icona = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: VERDE, strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

const VANTAGGI = [
  {
    titolo: "L'icona dei baffi sul telefono", sotto: "Ordini senza cercare il sito",
    icona: <svg {...icona}><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M11 18.5h2" /></svg>,
  },
  {
    titolo: "Avvisi sull'ordine", sotto: "Confermato, cambio orario, pronto",
    icona: <svg {...icona}><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>,
  },
  {
    titolo: "Tessera fedeltà sempre con te", sotto: "Sconti e QR a portata di mano",
    icona: <svg {...icona}><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="8.5" cy="12" r="1.5" /><circle cx="13" cy="12" r="1.5" /><circle cx="17.5" cy="12" r="1.5" /></svg>,
  },
];

const passi: React.CSSProperties = {
  margin: "8px 0 0", padding: "14px 16px 14px 36px", background: "#FFFFFF", border: `1px solid ${BORDO}`, borderRadius: 16,
  fontSize: 14, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 6, color: TESTO,
};

export default function InstallaApp({ qrSvg }: { qrSvg: string }) {
  const [pronto, setPronto] = useState(false);
  const [telefono, setTelefono] = useState<Telefono>("computer");
  const [installata, setInstallata] = useState(false);
  const [appInterna, setAppInterna] = useState(false);
  const [evento, setEvento] = useState<any>(null);
  const [esito, setEsito] = useState<"" | "ok" | "no">("");
  const [aperto, setAperto] = useState(false);

  useEffect(() => {
    // Già installata e aperta dall'icona: questa pagina non serve, si va dritti agli ordini.
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true || inAppNativa()) {
      window.location.replace("/ordina");
      return;
    }
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setTelefono(ios ? "ios" : /Android/i.test(ua) ? "android" : "computer");
    setAppInterna(/FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok|Snapchat/i.test(ua));
    setPronto(true);

    // Android/Chrome: il browser permette di far partire l'installazione con un nostro pulsante.
    const prima = (e: Event) => { e.preventDefault(); setEvento(e); };
    const fatto = () => { setInstallata(true); setEsito("ok"); };
    window.addEventListener("beforeinstallprompt", prima);
    window.addEventListener("appinstalled", fatto);
    // Registra subito il service worker: senza, il browser non offre l'installazione.
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw-ordina.js", { scope: "/ordina" }).catch(() => {});
    return () => { window.removeEventListener("beforeinstallprompt", prima); window.removeEventListener("appinstalled", fatto); };
  }, []);

  const installa = async () => {
    if (!evento) return;
    evento.prompt();
    try {
      const scelta = await evento.userChoice;
      setEsito(scelta?.outcome === "accepted" ? "ok" : "no");
    } catch {}
    setEvento(null);
  };

  // Il pulsante nero: dove il browser lo permette parte l'installazione, altrimenti (iPhone, altri browser) si aprono i passaggi.
  const clicInstalla = () => {
    if (telefono === "android" && evento && !appInterna) { installa(); return; }
    setAperto(true);
    // I passaggi si aprono sopra il pulsante fisso: si scorre in fondo così si leggono tutti, fino all'ultimo.
    setTimeout(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }), 80);
  };

  const Testata = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
      <div style={{ width: 96, height: 96, borderRadius: 24, background: "#FFFFFF", border: `1px solid ${BORDO}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* L'icona vera dell'app (quella del manifest): il cliente vede già cosa avrà sul telefono. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ordina-icons/icon-192.png" alt="" width={96} height={96} style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }} />
      </div>
      <h1 style={{ margin: 0, fontFamily: "'Playfair Display', var(--font-display)", fontWeight: 800, fontSize: 30, lineHeight: 1.12, color: TESTO }}>
        Don Basilico<br />sul tuo telefono
      </h1>
    </div>
  );

  const contenitore: React.CSSProperties = {
    maxWidth: 430, width: "100%", margin: "0 auto", boxSizing: "border-box", minHeight: "calc(100dvh - 74px)",
    display: "flex", flexDirection: "column", gap: 22, fontFamily: "var(--font-ui)", color: TESTO, padding: "14px 4px 0",
  };

  if (!pronto) return <div style={contenitore}>{Testata}</div>;

  const ios = telefono === "ios";

  return (
    <div style={contenitore}>
      {Testata}

      {appInterna && !installata && (
        <div role="note" style={{ background: "#FFFFFF", border: `1px solid ${BORDO}`, borderRadius: 16, padding: "14px 16px", fontSize: 14, lineHeight: 1.5 }}>
          <strong>Apri questa pagina nel browser.</strong> Stai usando il browser interno di un'altra app (Instagram, Facebook…), che non permette l'installazione: apri il link in <strong>{ios ? "Safari" : "Chrome"}</strong> (tocca i tre puntini o l'icona di condivisione e scegli «Apri nel browser»).
        </div>
      )}

      <ul style={{ listStyle: "none", margin: 0, padding: 0, background: "#FFFFFF", border: `1px solid ${BORDO}`, borderRadius: 22, overflow: "hidden" }}>
        {VANTAGGI.map((v, i) => (
          <li key={v.titolo} style={{ padding: "14px 16px", display: "flex", gap: 14, alignItems: "center", borderBottom: i < VANTAGGI.length - 1 ? "1px solid #EEEEE8" : "none" }}>
            <span style={ICONA_BOX}>{v.icona}</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{v.titolo}</span>
              <span style={{ fontSize: 14, color: "#5F6457" }}>{v.sotto}</span>
            </span>
          </li>
        ))}
      </ul>

      {installata ? (
        <div style={{ background: "#FFFFFF", border: `1px solid ${BORDO}`, borderRadius: 16, padding: "14px 16px", fontSize: 14, lineHeight: 1.5, textAlign: "center" }}>
          <strong>✓ App installata.</strong> Trovi l'icona dei baffi tra le tue app: aprila da lì, accedi con il tuo numero e attiva le notifiche.
        </div>
      ) : telefono === "computer" ? (
        <div style={{ background: "#FFFFFF", border: `1px solid ${BORDO}`, borderRadius: 22, padding: "18px 18px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Inquadra con il telefono</div>
          <div aria-label="QR code per installare l'app" style={{ width: 200, height: 200, margin: "14px auto 6px" }} dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p style={{ fontSize: 13.5, color: "#5F6457", lineHeight: 1.5, margin: "6px 0 0" }}>
            Apri la fotocamera e inquadra il codice. Oppure vai su <strong>ordina.donbasilico.it/app</strong> dal telefono.
          </p>
        </div>
      ) : (
        <details open={aperto} onToggle={(e) => setAperto((e.currentTarget as HTMLDetailsElement).open)} style={{ background: "transparent", borderRadius: 16 }}>
          <summary style={{ listStyle: "none", cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 14, fontWeight: 500, color: "#3E4237" }}>
            {ios ? "Come si installa su iPhone" : "Il pulsante non funziona?"}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              style={{ transform: aperto ? "rotate(180deg)" : "none", transition: "transform .15s" }}><path d="M6 9l6 6 6-6" /></svg>
          </summary>
          {ios ? (
            <ol style={passi}>
              <li>Apri questa pagina da <strong>Safari</strong> (se arrivi da un'altra app, copia il link e incollalo in Safari)</li>
              <li>Tocca il pulsante <strong>Condividi</strong> (il quadrato con la freccia verso l'alto) in basso</li>
              <li>Scorri e tocca <strong>«Aggiungi alla schermata Home»</strong>, poi <strong>«Aggiungi»</strong> in alto a destra</li>
              <li><strong>Apri l'app dall'icona</strong> (non da Safari): solo così l'iPhone permette le notifiche</li>
            </ol>
          ) : (
            <ol style={passi}>
              <li>Tocca i tre puntini <strong>⋮</strong> in alto nel browser</li>
              <li>Scegli <strong>Installa app</strong> o <strong>Aggiungi a schermata Home</strong></li>
              <li>Conferma e apri Don Basilico dall'icona</li>
            </ol>
          )}
        </details>
      )}

      {/* In basso, sempre a portata di pollice: l'azione principale e, più discreto, il modo di proseguire senza installare. */}
      <div style={{ marginTop: "auto", position: telefono === "computer" ? "static" : "sticky", bottom: 0, background: "#F6F6F1", padding: "10px 0 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        {installata ? (
          <a href="/ordina" style={{ width: "100%", height: 58, borderRadius: 18, background: TESTO, color: "#FFFFFF", fontSize: 17, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>Ordina ora</a>
        ) : (
          <>
            {telefono !== "computer" && (
              <button type="button" onClick={clicInstalla} style={{ width: "100%", height: 58, border: "none", borderRadius: 18, background: TESTO, color: "#FFFFFF", fontSize: 17, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", fontFamily: "inherit" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={VERDE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M5 20h14" /></svg>
                Installa l'app
              </button>
            )}
            {esito === "no" && <p style={{ margin: "2px 0 0", fontSize: 13, color: "#5F6457", textAlign: "center" }}>Nessun problema: puoi installarla più tardi dal menu del browser.</p>}
            <a href="/ordina" style={{ width: "100%", minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", color: "#3E4237", fontSize: 15, fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 3 }}>Continua senza installare</a>
          </>
        )}
      </div>
    </div>
  );
}
