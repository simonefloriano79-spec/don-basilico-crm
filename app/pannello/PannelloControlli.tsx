"use client";

import { useEffect, useRef, useState } from "react";
import { audioGiaConsentito, fermaSquillo, impostaSuonoMuto, sbloccaAudio, statoAudio, suonaNuovoOrdine, suonaSquillo, suonoMuto, vibraNuovoOrdine } from "@/lib/suono-ordine";
import { avviaBattito, tieniSchedaSveglia } from "@/lib/battito";

// Il suono suona 4 secondi, poi tace 5 secondi, e si ripete di continuo finché c'è un ordine da accettare che
// nessuno ha ancora VISUALIZZATO (aperto) su questo dispositivo. Aprire l'ordine o accettarlo/rifiutarlo lo ferma.
const SUONO_SEC = 4;
const PAUSA_MS = 5000;
const CHIAVE_VISTI = "db_ordini_visti";

function leggiVisti(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(CHIAVE_VISTI) ?? "[]")); } catch { return new Set(); }
}
function salvaVisti(s: Set<string>) {
  try { sessionStorage.setItem(CHIAVE_VISTI, JSON.stringify(Array.from(s).slice(-200))); } catch {}
}

// Striscia sotto la barra in alto: suono (che si ripete finché c'è un ordine non visto), schermo sempre acceso,
// schermo intero. Il resto dell'aspetto è quello del CRM.
export function PannelloControlli() {
  const [ids, setIds] = useState<string[]>([]);       // ordini online in attesa di accettazione
  const [visti, setVisti] = useState<Set<string>>(() => new Set());
  const [muto, setMuto] = useState(false);
  const [audioPronto, setAudioPronto] = useState(false);
  const [saltato, setSaltato] = useState(false); // «Continua senza suono»: il popup non si riapre finché non si ricarica la pagina
  const [schermoAcceso, setSchermoAcceso] = useState(false);
  const [ultimoControllo, setUltimoControllo] = useState<Date | null>(null);
  // Diagnostica (visibile nella barra): quanto è stata lunga al massimo la pausa tra due controlli e com'era la pagina all'ultimo suono.
  const [pausaMaxSec, setPausaMaxSec] = useState(0);
  const [ultimoSuonoInfo, setUltimoSuonoInfo] = useState("");
  const ultimaCaricaMs = useRef(0);
  const wakeLock = useRef<any>(null);

  const daAccettare = ids.length;
  const nonVisti = ids.filter((id) => !visti.has(id)).length;

  // Valori aggiornati per il timer del suono (che non si ricrea a ogni render).
  const nonVistiRef = useRef(0);
  const audioRef = useRef(false);
  const prossimoSuono = useRef(0);
  useEffect(() => { nonVistiRef.current = nonVisti; }, [nonVisti]);
  useEffect(() => { audioRef.current = audioPronto; if (audioPronto) prossimoSuono.current = 0; }, [audioPronto]);

  useEffect(() => { setMuto(suonoMuto()); setVisti(leggiVisti()); }, []);

  // Se il browser lascia già suonare senza un tocco (es. collegamento Chrome con autoplay consentito) il popup non serve:
  // si attiva da solo, e il pannello è pronto appena aperto.
  useEffect(() => {
    let vivo = true;
    audioGiaConsentito().then((ok) => { if (vivo && ok) { setAudioPronto(true); accendiSchermo(); } }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const segnaVisti = (nuovi: string[]) => {
    setVisti((prima) => {
      const s = new Set(prima);
      nuovi.forEach((id) => s.add(id));
      salvaVisti(s);
      return s;
    });
  };

  // Aprire un ordine (pagina Ordini) = averlo visto.
  useEffect(() => {
    const onVisto = (e: Event) => { const id = (e as CustomEvent).detail; if (typeof id === "string") segnaVisti([id]); };
    window.addEventListener("db-ordine-visto", onVisto);
    return () => window.removeEventListener("db-ordine-visto", onVisto);
  }, []);

  // Controllo degli ordini in attesa (ogni 3 secondi) e suono (ogni secondo), guidati da un «battito» in un Web Worker:
  // i timer normali di Chrome, con la finestra coperta da un'altra o in una scheda dietro, dopo pochi minuti scattano una
  // volta al minuto e il pannello sembrerebbe addormentato; il battito del worker non viene rallentato (vedi lib/battito.ts).
  useEffect(() => {
    let attivo = true;
    let inCorso = false;
    const carica = () => {
      if (inCorso) return;
      inCorso = true;
      fetch("/api/ordini/da-accettare", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => {
        if (!attivo || !d) return;
        const adessoMs = Date.now();
        if (ultimaCaricaMs.current) setPausaMaxSec((m) => Math.max(m, Math.round((adessoMs - ultimaCaricaMs.current) / 1000)));
        ultimaCaricaMs.current = adessoMs;
        setUltimoControllo(new Date());
        const nuoviIds: string[] = Array.isArray(d.ids) ? d.ids : [];
        setIds((prima) => {
          // Un ordine nuovo fa suonare subito, senza aspettare la pausa.
          if (nuoviIds.some((id) => !prima.includes(id))) prossimoSuono.current = 0;
          return nuoviIds;
        });
      }).catch(() => {}).finally(() => { inCorso = false; });
    };
    carica();

    let battiti = 0;
    const ferma = avviaBattito(1000, () => {
      battiti++;
      if (battiti % 3 === 0) carica();
      // Il suono: finché c'è un ordine non visto, 4 secondi di allarme, 5 di pausa, e così via.
      if (nonVistiRef.current === 0) { fermaSquillo(); prossimoSuono.current = 0; return; }
      if (!audioRef.current) return; // suono non ancora attivato dal popup
      const adesso = Date.now();
      if (adesso >= prossimoSuono.current) {
        suonaSquillo(SUONO_SEC);
        vibraNuovoOrdine();
        prossimoSuono.current = adesso + SUONO_SEC * 1000 + PAUSA_MS;
        setUltimoSuonoInfo(`${new Date().toLocaleTimeString("it-IT")} · audio ${statoAudio()} · pagina ${document.visibilityState === "visible" ? "davanti" : "dietro"}`);
      }
    });
    // Appena la finestra torna visibile si ricontrolla subito.
    const alRitorno = () => { if (document.visibilityState === "visible") carica(); };
    document.addEventListener("visibilitychange", alRitorno);
    const rilascia = tieniSchedaSveglia("db-pannello-ordini");
    return () => { attivo = false; ferma(); rilascia(); document.removeEventListener("visibilitychange", alRitorno); fermaSquillo(); };
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

  // Il browser permette l'audio solo dopo un tocco: il popup «sblocca» suono e schermo acceso. Se c'è già un ordine non
  // visto, subito dopo il tocco il suono parte da solo (il timer lo avvia entro un secondo).
  const attiva = async () => {
    sbloccaAudio(); // un solo contesto audio, sbloccato da questo tocco, usato per tutti i suoni successivi
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
          <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", maxWidth: 460, width: "100%", textAlign: "center", fontFamily: "var(--font-ui)" }}>
            {daAccettare > 0 && (
              <div style={{ animation: "dbLampeggia 0.9s infinite", color: "#fff", fontWeight: 700, fontSize: 17, padding: "14px 16px", letterSpacing: 0.4 }}>
                {daAccettare === 1 ? "C'È 1 ORDINE DA ACCETTARE!" : `CI SONO ${daAccettare} ORDINI DA ACCETTARE!`}
              </div>
            )}
            <div style={{ padding: "26px 26px 22px" }}>
              <div style={{ fontSize: 46, lineHeight: 1 }}>🔔</div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, margin: "14px 0 8px", color: "var(--text)" }}>Attiva gli avvisi degli ordini</h2>
              <p style={{ fontSize: 14.5, lineHeight: 1.5, color: "var(--text-2)", margin: "0 0 8px" }}>
                Tocca il pulsante: da questo momento il pannello <strong>suona forte</strong> ogni volta che arriva un ordine online, e <strong>ripete ogni 5 secondi</strong> finché non lo apri. Tiene anche lo schermo acceso.
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

      {/* Ordine da accettare: striscia rossa che lampeggia finché non viene visto; poi resta rossa fissa finché non si accetta. */}
      {daAccettare > 0 && (
        <div role="alert" style={{
          ...(nonVisti > 0 ? { animation: "dbLampeggia 0.9s infinite" } : { background: "#c0392b" }),
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap",
          fontWeight: 700, fontSize: 17, letterSpacing: 0.4, padding: "13px 16px", fontFamily: "var(--font-ui)",
        }}>
          <span>{daAccettare === 1 ? "1 ORDINE ONLINE DA ACCETTARE" : `${daAccettare} ORDINI ONLINE DA ACCETTARE`}</span>
          {nonVisti > 0 && (
            <button onClick={() => segnaVisti(ids)} style={{
              background: "#fff", color: "#7d1f15", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13,
              fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-ui)",
            }}>
              Ho visto: ferma il suono
            </button>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, padding: "8px 26px", background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
        {/* Segno di vita: l'ora dell'ultimo controllo degli ordini. Se è ferma da minuti, il pannello non sta controllando. */}
        <span title="Ora dell'ultimo controllo degli ordini online e pausa più lunga tra due controlli da quando la pagina è aperta" style={{ color: "var(--text-muted)", fontSize: 12 }}>
          Ultimo controllo: {ultimoControllo ? ultimoControllo.toLocaleTimeString("it-IT") : "…"} · pausa max {pausaMaxSec} s
          {ultimoSuonoInfo ? ` · ultimo suono ${ultimoSuonoInfo}` : ""}
        </span>
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
