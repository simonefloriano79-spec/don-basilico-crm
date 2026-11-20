"use client";

import { useEffect, useRef, useState } from "react";
import { fermaSquillo, impostaSuonoMuto, suonaNuovoOrdine, suonaSquillo, suonoMuto, vibraNuovoOrdine } from "@/lib/suono-ordine";

// Nuovo ordine: suoneria continua per 25 s; poi, finché resta da accettare, un richiamo di 8 s ogni 20 s.
const SQUILLO_NUOVO_SEC = 25;
const SQUILLO_RICHIAMO_SEC = 8;
const RIPETI_OGNI_MS = 20000;

// Striscia sotto la barra in alto: suono (che si ripete finché c'è qualcosa da accettare), schermo sempre acceso,
// schermo intero. Il resto dell'aspetto è quello del CRM.
export function PannelloControlli() {
  const [daAccettare, setDaAccettare] = useState(0);
  const [muto, setMuto] = useState(false);
  const [audioPronto, setAudioPronto] = useState(false);
  const [saltato, setSaltato] = useState(false); // «Continua senza suono»: il popup non si riapre finché non si ricarica la pagina
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
          vibraNuovoOrdine();
          ultimoSuono.current = adesso + SQUILLO_NUOVO_SEC * 1000;
        } else if (adesso - ultimoSuono.current >= RIPETI_OGNI_MS) {
          suonaSquillo(SQUILLO_RICHIAMO_SEC);
          vibraNuovoOrdine();
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

  // Il browser permette l'audio solo dopo un tocco: il popup «sblocca» suono e schermo acceso (e fa sentire subito il suono).
  const attiva = async () => {
    suonaNuovoOrdine(true);
    vibraNuovoOrdine();
    setAudioPronto(true);
    await accendiSchermo();
  };

  const btn: React.CSSProperties = {
    background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)", padding: "6px 12px",
    borderRadius: 8, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)", whiteSpace: "nowrap",
  };

  return (
    <>
      <style>{"@keyframes dbLampeggia{0%,100%{background:#c0392b}50%{background:#7d1f15}}"}</style>

      {/* Popup di attivazione: finché non si tocca il pulsante il browser non lascia suonare né tenere lo schermo acceso. */}
      {!audioPronto && !saltato && (
        <div role="dialog" aria-modal="true" aria-label="Attiva gli avvisi degli ordini" style={{
          position: "fixed", inset: 0, zIndex: 2000, background: "rgba(20,22,16,0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "30px 26px 22px", maxWidth: 460, width: "100%", textAlign: "center", fontFamily: "var(--font-ui)" }}>
            <div style={{ fontSize: 46, lineHeight: 1 }}>🔔</div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, margin: "14px 0 8px", color: "var(--text)" }}>Attiva gli avvisi degli ordini</h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.5, color: "var(--text-2)", margin: "0 0 8px" }}>
              Tocca il pulsante: da questo momento il pannello <strong>suona forte</strong> ogni volta che arriva un ordine online e tiene lo schermo acceso.
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)", margin: "0 0 20px" }}>
              Metti anche il <strong>volume del dispositivo al massimo</strong>. Va rifatto ogni volta che si apre o si ricarica questa pagina.
            </p>
            <button onClick={attiva} style={{
              width: "100%", border: "none", background: "var(--text)", color: "#fff", padding: "17px 18px", borderRadius: 14,
              fontSize: 17, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-ui)",
            }}>
              Attiva suono e schermo acceso
            </button>
            <button onClick={() => setSaltato(true)} style={{
              marginTop: 10, background: "none", border: "none", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer",
              textDecoration: "underline", fontFamily: "var(--font-ui)", padding: 8,
            }}>
              Continua senza suono
            </button>
          </div>
        </div>
      )}

      {!audioPronto && saltato && (
        <button onClick={attiva} style={{
          display: "block", width: "100%", border: "none", background: "var(--text)", color: "#fff", padding: "13px 18px",
          fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)",
        }}>
          Il suono è spento: tocca qui per attivare suono e schermo sempre acceso
        </button>
      )}

      {/* Ordine da accettare: striscia rossa che lampeggia, impossibile non vederla. */}
      {daAccettare > 0 && (
        <div role="alert" style={{
          animation: "dbLampeggia 0.9s infinite", color: "#fff", textAlign: "center", fontWeight: 700,
          fontSize: 17, letterSpacing: 0.4, padding: "13px 16px", fontFamily: "var(--font-ui)",
        }}>
          {daAccettare === 1 ? "1 ORDINE ONLINE DA ACCETTARE" : `${daAccettare} ORDINI ONLINE DA ACCETTARE`}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, padding: "8px 26px", background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
        {audioPronto && !schermoAcceso && (
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
            Lo schermo potrebbe spegnersi: impostalo su «mai» dalle impostazioni del dispositivo.
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btn} onClick={() => { suonaNuovoOrdine(true); vibraNuovoOrdine(); }} title="Fa sentire il suono di un nuovo ordine, per regolare il volume">
            ▶ Prova suono
          </button>
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
