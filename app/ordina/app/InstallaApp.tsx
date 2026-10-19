"use client";

import { useEffect, useState } from "react";

type Telefono = "android" | "ios" | "computer";

const btn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: 54, borderRadius: 27, border: "none",
  background: "var(--text, #1B1E17)", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", textDecoration: "none", boxSizing: "border-box",
};
const btnSec: React.CSSProperties = { ...btn, background: "transparent", color: "var(--text, #1B1E17)", border: "1.5px solid var(--text, #1B1E17)" };
const scheda: React.CSSProperties = { background: "#fff", border: "1px solid #DADBD2", borderRadius: 20, padding: "18px 18px 20px" };
const passi: React.CSSProperties = { fontSize: 15, color: "#3E4238", lineHeight: 1.75, paddingLeft: 22, margin: "10px 0 0" };

export default function InstallaApp({ qrSvg }: { qrSvg: string }) {
  const [pronto, setPronto] = useState(false);
  const [telefono, setTelefono] = useState<Telefono>("computer");
  const [installata, setInstallata] = useState(false);
  const [appInterna, setAppInterna] = useState(false);
  const [evento, setEvento] = useState<any>(null);
  const [esito, setEsito] = useState<"" | "ok" | "no">("");

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setTelefono(ios ? "ios" : /Android/i.test(ua) ? "android" : "computer");
    setAppInterna(/FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok|Snapchat/i.test(ua));
    setInstallata(window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);
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

  const Titolo = (
    <>
      <div style={{ fontFamily: "'Playfair Display', var(--font-display)", fontWeight: 800, fontSize: 30, lineHeight: 1.15, color: "var(--text, #1B1E17)", textAlign: "center", marginTop: 8 }}>
        Don Basilico<br />sul tuo telefono
      </div>
      <p style={{ fontSize: 15, color: "#3E4238", textAlign: "center", lineHeight: 1.5, margin: "12px auto 0", maxWidth: 420 }}>
        Ordini in due tocchi e ricevi un avviso quando la pizzeria conferma l'ordine e quando è pronto. È gratis e non serve nessuno store.
      </p>
    </>
  );

  if (!pronto) return <div style={{ padding: "24px 0" }}>{Titolo}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "10px 0 20px" }}>
      {Titolo}

      {installata ? (
        <div style={{ ...scheda, textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text, #1B1E17)" }}>✓ L'app è già installata</div>
          <p style={{ fontSize: 14, color: "#3E4238", lineHeight: 1.5, margin: "8px 0 16px" }}>Aprila dall'icona sul telefono. Alla prima volta ti chiediamo se vuoi attivare le notifiche.</p>
          <a href="/ordina" style={btn}>Ordina ora</a>
        </div>
      ) : appInterna ? (
        <div style={scheda}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text, #1B1E17)" }}>Apri questa pagina nel browser</div>
          <p style={{ fontSize: 14.5, color: "#3E4238", lineHeight: 1.55, margin: "8px 0 0" }}>
            Stai usando il browser interno di un'altra app (Instagram, Facebook…), che non permette l'installazione. Apri il link in <strong>{telefono === "ios" ? "Safari" : "Chrome"}</strong>: tocca i tre puntini o l'icona di condivisione e scegli «Apri nel browser».
          </p>
        </div>
      ) : telefono === "android" ? (
        <div style={scheda}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text, #1B1E17)" }}>Installa su Android</div>
          {esito === "ok" ? (
            <p style={{ fontSize: 14.5, color: "#3E4238", lineHeight: 1.55, margin: "10px 0 0" }}>Fatto! Trovi l'icona di Don Basilico tra le tue app. Aprila da lì, accedi con il tuo numero e attiva le notifiche.</p>
          ) : (
            <>
              {evento && <button type="button" onClick={installa} style={{ ...btn, marginTop: 14 }}>Installa l'app</button>}
              <div style={{ fontSize: 13.5, color: "#5F6457", marginTop: evento ? 14 : 8 }}>{evento ? "Se il pulsante non funziona:" : "Segui questi passaggi:"}</div>
              <ol style={passi}>
                <li>Tocca il menu del browser (i tre puntini <strong>⋮</strong> in alto).</li>
                <li>Scegli <strong>«Installa app»</strong> o <strong>«Aggiungi a schermata Home»</strong>.</li>
                <li>Conferma, poi apri Don Basilico dall'icona.</li>
              </ol>
              {esito === "no" && <p style={{ fontSize: 13, color: "#5F6457", marginTop: 10 }}>Nessun problema: puoi installarla più tardi con il menu del browser.</p>}
            </>
          )}
        </div>
      ) : telefono === "ios" ? (
        <div style={scheda}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text, #1B1E17)" }}>Installa su iPhone</div>
          <p style={{ fontSize: 13.5, color: "#5F6457", margin: "6px 0 0" }}>Funziona da <strong>Safari</strong>. Se hai aperto il link da un'altra app, copialo e incollalo in Safari.</p>
          <ol style={passi}>
            <li>Tocca il pulsante <strong>Condividi</strong> (il quadrato con la freccia verso l'alto) in basso.</li>
            <li>Scorri e tocca <strong>«Aggiungi alla schermata Home»</strong>.</li>
            <li>Tocca <strong>«Aggiungi»</strong> in alto a destra.</li>
            <li><strong>Apri l'app dall'icona</strong> (non da Safari): solo così l'iPhone permette le notifiche.</li>
          </ol>
        </div>
      ) : (
        <div style={{ ...scheda, textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text, #1B1E17)" }}>Inquadra con il telefono</div>
          <div aria-label="QR code per installare l'app" style={{ width: 220, height: 220, margin: "14px auto 6px" }} dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p style={{ fontSize: 13.5, color: "#5F6457", lineHeight: 1.5, margin: "6px 0 0" }}>Apri la fotocamera, inquadra il codice e segui le istruzioni. Oppure vai su <strong>ordina.donbasilico.it/app</strong> dal telefono.</p>
        </div>
      )}

      {!installata && (
        <div style={{ ...scheda, background: "var(--accent-bg-2, #F1F5E4)", border: "1px solid var(--accent-border, #D6E0B5)" }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text, #1B1E17)" }}>Cosa ci guadagni</div>
          <ul style={{ fontSize: 14, color: "#3E4238", lineHeight: 1.65, margin: "8px 0 0", paddingLeft: 20 }}>
            <li>L'icona dei baffi sul telefono: ordini senza cercare il sito</li>
            <li>Avvisi quando l'ordine è confermato, se cambia l'orario e quando è pronto</li>
            <li>La tessera fedeltà sempre a portata di mano</li>
          </ul>
        </div>
      )}

      {!installata && <a href="/ordina" style={btnSec}>Continua senza installare</a>}
    </div>
  );
}
