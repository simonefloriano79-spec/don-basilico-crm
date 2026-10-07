"use client";

import { useEffect, useRef, useState } from "react";
import { fermaSquillo, impostaSuonoMuto, suonaNuovoOrdine, suonaSquillo, suonoMuto } from "@/lib/suono-ordine";

// Nuovo ordine: suoneria continua per 20 s; poi, finché resta da accettare, un richiamo di 6 s ogni 25 s.
const SQUILLO_NUOVO_SEC = 20;
const SQUILLO_RICHIAMO_SEC = 6;
const RIPETI_OGNI_MS = 25000;

// Striscia sotto la barra in alto: suono (che si ripete finché c'è qualcosa da accettare), schermo sempre acceso,
// schermo intero. Il resto dell'aspetto è quello del CRM.
export function PannelloControlli() {
  const [daAccettare, setDaAccettare] = useState(0);
  const [muto, setMuto] = useState(false);
  const [audioPronto, setAudioPronto] = useState(false);
  const [schermoAcceso, setSchermoAcceso] = useState(false);
  const precedente = useRef<number | null>(null);
  const ultimoSuono = useRef(0);
  const wakeLock = useRef<any>(null);

  useEffect(() => { setMuto(suonoMuto()); }, []);

  useEffect(() => {
    let attivo = true;
    const carica = () =>
      fetch("/api/ordini/da-accettare").then((r) => (r.ok ? r.json() : null)).then((d) => {
        if (!attivo || !d) return;
        const adesso = Date.now();
        const nuovo = d.n > (precedente.current ?? 0);
        if (d.n === 0) {
          fermaSquillo();
        } else if (nuovo) {
          suonaSquillo(SQUILLO_NUOVO_SEC);
          ultimoSuono.current = adesso + SQUILLO_NUOVO_SEC * 1000;
        } else if (adesso - ultimoSuono.current >= RIPETI_OGNI_MS) {
          suonaSquillo(SQUILLO_RICHIAMO_SEC);
          ultimoSuono.current = adesso + SQUILLO_RICHIAMO_SEC * 1000;
        }
        precedente.current = d.n;
        setDaAccettare(d.n);
      }).catch(() => {});
    carica();
    const iv = setInterval(carica, 5000);
    return () => { attivo = false; clearInterval(iv); fermaSquillo(); };
  }, []);

  // Titolo della scheda col numero: si vede anche con la scheda in background.
  useEffect(() => {
    document.title = daAccettare > 0 ? `(${daAccettare}) Da accettare — Don Basilico` : "Ordini online — Don Basilico";
  }, [daAccettare]);

  // Schermo sempre acceso (dove il browser lo permette), da riprendere quando la scheda torna visibile.
  const accendiSchermo = async () => {
    try {
      const nav: any = navigator;
      if (!nav.wakeLock) return false;
      wakeLock.current = await nav.wakeLock.request("screen");
      setSchermoAcceso(true);
      wakeLock.current.addEventListener?.("release", () => setSchermoAcceso(false));
      return true;
    } catch { return false; }
  };
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible" && audioPronto) accendiSchermo(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [audioPronto]);

  // Il browser permette l'audio solo dopo un click: un pulsante evidente lo "sblocca".
  const attiva = async () => {
    suonaNuovoOrdine(true);
    setAudioPronto(true);
    await accendiSchermo();
  };

  const btn: React.CSSProperties = {
    background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)", padding: "6px 12px",
    borderRadius: 8, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)", whiteSpace: "nowrap",
  };

  return (
    <>
      {!audioPronto && (
        <button onClick={attiva} style={{
          display: "block", width: "100%", border: "none", background: "var(--text)", color: "#fff", padding: "13px 18px",
          fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)",
        }}>
          Tocca qui per attivare suono e schermo sempre acceso: serve ogni volta che apri o ricarichi la pagina
        </button>
      )}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, padding: "8px 26px", background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
        {daAccettare > 0 && (
          <span style={{ background: "var(--danger)", color: "#fff", borderRadius: 20, fontSize: 12.5, fontWeight: 600, padding: "3px 12px" }}>
            {daAccettare} da accettare
          </span>
        )}
        {audioPronto && !schermoAcceso && (
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
            Lo schermo potrebbe spegnersi: impostalo su «mai» dalle impostazioni del dispositivo.
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button style={btn} onClick={() => { const v = !muto; setMuto(v); impostaSuonoMuto(v); if (v) fermaSquillo(); else suonaNuovoOrdine(true); }}>
            {muto ? "🔕 Suono spento" : "🔔 Suono acceso"}
          </button>
          <button style={btn} onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}>
            Schermo intero
          </button>
        </div>
      </div>
    </>
  );
}
