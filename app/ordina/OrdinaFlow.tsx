"use client";

import { useEffect, useRef, useState } from "react";
import { COSTO_CONSEGNA_DEFAULT } from "@/lib/consegna";
import PaginaTessera from "./PaginaTessera";
import { allergeniProdotto, testoAllergeni } from "@/lib/allergeni";

const CAT_LABEL: Record<string, string> = {
  pizze: "Pizze", pizze_rosse: "Pizze rosse", pizze_bianche: "Pizze bianche",
  calzoni: "Calzoni", fritti: "Fritti", bevande: "Bevande", dolci: "Dolci",
  extra: "Extra", menu_speciale: "Speciali", focacce: "Focacce",
};

const fieldSt: React.CSSProperties = {
  width: "100%", background: "#fff", border: "1px solid var(--border)",
  color: "var(--text)", padding: "14px 16px", borderRadius: 14, fontSize: 16,
  outline: "none", fontFamily: "var(--font-ui)",
};
const btnPrimarySt: React.CSSProperties = {
  width: "100%", background: "var(--text)", color: "#fff", border: "none",
  padding: 16, borderRadius: 14, fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)",
};

// Pulsanti di scelta (pagamento, orario): selezionato = nero con testo bianco, non selezionato = bianco con bordo scuro.
const sceltaSt = (selezionato: boolean): React.CSSProperties =>
  selezionato
    ? { background: "var(--text)", color: "#fff", borderColor: "var(--text)", fontWeight: 600 }
    : { background: "#fff", color: "var(--text)", borderColor: "#8a897f" };

const STATO_CLIENTE: Record<string, { testo: (tipo: string) => string; colore: string; attivo: boolean }> = {
  nuovo: { testo: () => "In attesa di conferma", colore: "#b45309", attivo: true },
  confermato: { testo: () => "Confermato", colore: "#4d7c1c", attivo: true },
  in_preparazione: { testo: () => "In preparazione", colore: "#4d7c1c", attivo: true },
  pronto: { testo: (t) => (t === "domicilio" ? "Pronto, sta per partire" : "Pronto da ritirare"), colore: "#4d7c1c", attivo: true },
  consegnato: { testo: (t) => (t === "domicilio" ? "Consegnato" : "Ritirato"), colore: "#6b6a60", attivo: false },
  annullato: { testo: () => "Annullato", colore: "#b42318", attivo: false },
};

function dataOra(d: string): string {
  return new Date(d).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// "I miei ordini": ordini fatti dal sito, con lo stato che si aggiorna da solo.
function MieiOrdini({ onIndietro }: { onIndietro: () => void }) {
  const [ordini, setOrdini] = useState<any[] | null>(null);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    let attivo = true;
    const carica = () =>
      fetch("/api/ordina/ordini")
        .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
        .then(({ ok, d }) => { if (!attivo) return; if (ok) { setOrdini(d.ordini ?? []); setErrore(""); } else setErrore(d.error ?? "Non riesco a caricare gli ordini"); })
        .catch(() => attivo && setErrore("Non riesco a caricare gli ordini"));
    carica();
    const iv = setInterval(carica, 15000);
    return () => { attivo = false; clearInterval(iv); };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 520, width: "100%", margin: "0 auto" }}>
      <button onClick={onIndietro} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, cursor: "pointer", padding: "4px 0" }}>← Indietro</button>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text)", textAlign: "center" }}>I miei ordini</h1>
      {errore && <div style={{ fontSize: 13, color: "var(--danger)", textAlign: "center" }}>{errore}</div>}
      {ordini === null && !errore && <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Carico…</div>}
      {ordini && ordini.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14, lineHeight: 1.5 }}>Non hai ancora fatto ordini dal sito.</div>
      )}
      {(ordini ?? []).map((o) => {
        const st = STATO_CLIENTE[o.stato] ?? { testo: () => o.stato, colore: "#6b6a60", attivo: false };
        const orario = o.oraConsegnaComunicata ?? o.oraRichiesta;
        return (
          <div key={o.id} style={{ background: "#fff", border: `1.5px solid ${st.attivo ? "var(--text)" : "var(--border)"}`, borderRadius: 16, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text)" }}>#{o.numeroOrdine}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: st.colore }}>{st.testo(o.tipo)}</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
              {o.sede?.nome?.replace("Don Basilico ", "")} · {o.tipo === "domicilio" ? "Consegna a domicilio" : "Ritiro in sede"} · ordinato il {dataOra(o.createdAt)}
            </div>
            {orario && (
              <div style={{ fontSize: 13.5, color: "var(--text)", marginTop: 6 }}>
                {o.oraConsegnaComunicata ? (o.tipo === "domicilio" ? "Consegna prevista" : "Ritiro previsto") : (o.tipo === "domicilio" ? "Consegna richiesta" : "Ritiro richiesto")}: <strong>{dataOra(orario)}</strong>
                {o.stato === "nuovo" && " (da confermare)"}
              </div>
            )}
            {o.tipo === "domicilio" && o.clienteIndirizzo && (
              <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>{o.clienteIndirizzo}</div>
            )}
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 10, paddingTop: 8 }}>
              {(o.items ?? []).map((i: any) => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, color: "var(--text-2)", marginBottom: 3 }}>
                  <span>{i.quantita}× {i.nomeSnapshot}{i.noteItem ? <span style={{ color: "var(--text-muted)" }}> ({i.noteItem})</span> : null}</span>
                  <span className="num">{euro(parseFloat(i.prezzoSnapshot) * i.quantita)}</span>
                </div>
              ))}
              {parseFloat(o.costoConsegna) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text-muted)" }}><span>Consegna</span><span className="num">{euro(parseFloat(o.costoConsegna))}</span></div>
              )}
              {parseFloat(o.scontoFedelta) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--accent-ink)" }}><span>Sconto fedeltà</span><span className="num">-{euro(parseFloat(o.scontoFedelta))}</span></div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontWeight: 700, color: "var(--text)" }}>
                <span>Totale</span><span className="num">{euro(parseFloat(o.totale))}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Caselle di consenso: informativa privacy obbligatoria, marketing facoltativo.
function ConsensiPrivacy({ privacy, setPrivacy, marketing, setMarketing }: { privacy: boolean; setPrivacy: (v: boolean) => void; marketing: boolean; setMarketing: (v: boolean) => void }) {
  const casella: React.CSSProperties = { width: 20, height: 20, marginTop: 1, flexShrink: 0, accentColor: "#1c1d18" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "var(--text-2)", lineHeight: 1.45, cursor: "pointer" }}>
        <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} style={casella} />
        <span>Ho letto l'<a href="/ordina/privacy" target="_blank" rel="noreferrer" style={{ color: "var(--accent-ink)", textDecoration: "underline" }}>informativa privacy</a> e accetto il trattamento dei miei dati per gestire l'ordine e la tessera fedeltà. <strong>(obbligatorio)</strong></span>
      </label>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "var(--text-2)", lineHeight: 1.45, cursor: "pointer" }}>
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} style={casella} />
        <span>Voglio ricevere offerte e novità da Don Basilico. <span style={{ color: "var(--text-muted)" }}>(facoltativo)</span></span>
      </label>
    </div>
  );
}

// Tessera fedeltà: cerchietti dei timbri e messaggio.
function CartaFedelta({ tessera, onApri }: { tessera: Tessera | null; onApri: () => void }) {
  const timbri = tessera?.timbri ?? 0;
  const mancano = TIMBRI_PER_CICLO - timbri;
  const scontoAccumulato = tessera ? Math.round(tessera.totaleCiclo * 0.1 * 100) / 100 : 0;
  return (
    <section style={{ background: "#FFFFFF", border: "1px solid #E4E5DD", borderRadius: 22, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, color: "#5F6457", textTransform: "uppercase" }}>Tessera fedeltà</span>
        <span className="num" style={{ fontSize: 14, color: "#1B1E17" }}>{timbri} di {TIMBRI_PER_CICLO}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {Array.from({ length: TIMBRI_PER_CICLO }).map((_, i) => (
            <span key={i} style={{
              width: 22, height: 22, borderRadius: "50%", boxSizing: "border-box",
              background: i < timbri ? "#7ECE25" : "transparent", border: i < timbri ? "none" : "1.5px solid #A5A99C",
            }} />
          ))}
        </div>
        <span style={{ fontSize: 13, lineHeight: 1.3, color: "#3E4237" }}>
          {tessera?.scontoDisponibile
            ? "Hai uno sconto pronto: lo usi al prossimo ordine"
            : tessera
              ? `Ancora ${mancano} ${mancano === 1 ? "ordine" : "ordini"} per il 10% di sconto`
              : `Ogni ${TIMBRI_PER_CICLO} ordini ottieni il 10% di sconto`}
        </span>
      </div>
      <div style={{ height: 1, background: "#ECECE5" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        {tessera ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 13, color: "#5F6457" }}>Sconto accumulato</span>
            <span className="num" style={{ fontFamily: "'Playfair Display', var(--font-display)", fontWeight: 800, fontSize: 26, lineHeight: 1.1, color: "#1B1E17" }}>{euro(tessera.scontoDisponibile ? tessera.importoSconto : scontoAccumulato)}</span>
          </div>
        ) : (
          <span style={{ fontSize: 13, color: "#5F6457", lineHeight: 1.3 }}>Si attiva con il tuo primo ordine</span>
        )}
        <button type="button" onClick={onApri} style={{
          height: 44, padding: "0 16px", borderRadius: 999, border: "1.5px solid #1B1E17", background: "#FFFFFF", color: "#1B1E17",
          fontSize: 15, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: "var(--font-ui)", whiteSpace: "nowrap", flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3z" /><path d="M20 14v.01M20 20h-3M14 20v.01" /></svg>
          {tessera ? "Tessera e QR" : "Attiva la tessera"}
        </button>
      </div>
    </section>
  );
}

// Registrazione dell'evento di installazione (arriva una volta sola, spesso prima che il pulsante sia visibile).
let eventoInstalla: any = null;

type ModoLogo = "grande" | "home" | "piccolo" | "nascosto";
function Testata({ modo }: { modo: ModoLogo }) {
  if (modo === "nascosto") return null;
  return (
    <img
      src="/brand/don-basilico-logo.png"
      alt="Don Basilico — Naturalmente Pizza"
      style={modo === "grande"
        ? { display: "block", width: "min(80vw, 340px)", height: "auto", margin: "10px auto 26px" }
        : modo === "home"
          ? { display: "block", width: 186, height: "auto", margin: "10px auto 22px" }
          : { display: "block", width: 118, height: "auto", margin: "4px auto 16px" }}
    />
  );
}

// "Scarica sul tuo cellulare": installa l'app (aggiunge l'icona alla schermata Home). Dove il browser lo permette
// (Android/Chrome) parte l'installazione; altrove (iPhone, altri browser) mostra i passaggi.
function BottoneInstalla({ discreto = false }: { discreto?: boolean }) {
  const [installata, setInstallata] = useState(false);
  const [aiuto, setAiuto] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    if (standalone) setInstallata(true);
    const fatto = () => setInstallata(true);
    window.addEventListener("appinstalled", fatto);
    return () => window.removeEventListener("appinstalled", fatto);
  }, []);

  if (installata) return null;

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const appInterna = /FBAN|FBAV|Instagram|Line\/|MicroMessenger/i.test(ua);

  const clic = async () => {
    if (eventoInstalla) {
      eventoInstalla.prompt();
      try { await eventoInstalla.userChoice; } catch {}
      eventoInstalla = null;
      return;
    }
    setAiuto(true);
  };

  return (
    <>
      <button onClick={clic} style={{
        ...btnPrimarySt, background: "transparent", color: "var(--text)", border: "1.5px solid var(--text)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        ...(discreto ? { border: "none", color: "#555950", fontSize: 14, minHeight: 44, padding: "8px" } : {}),
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12" /><path d="M7 11l5 5 5-5" /><path d="M5 21h14" />
        </svg>
        Scarica sul tuo cellulare
      </button>

      {aiuto && (
        <div onClick={() => setAiuto(false)} style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", width: "100%", maxWidth: 520, borderRadius: "22px 22px 0 0", padding: "24px 22px 30px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text)", marginBottom: 12 }}>Aggiungi Don Basilico al telefono</div>
            {appInterna ? (
              <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.55 }}>
                Stai usando il browser interno di un'altra app. Apri questa pagina in <strong>Safari</strong> (iPhone) o <strong>Chrome</strong> (Android) e poi premi di nuovo questo pulsante.
              </p>
            ) : ios ? (
              <ol style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
                <li>Tocca il pulsante <strong>Condividi</strong> (il quadrato con la freccia verso l'alto) in basso.</li>
                <li>Scorri e tocca <strong>«Aggiungi alla schermata Home»</strong>.</li>
                <li>Tocca <strong>«Aggiungi»</strong>: l'icona dei baffi comparirà tra le tue app.</li>
              </ol>
            ) : (
              <ol style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
                <li>Tocca il menu del browser (i tre puntini <strong>⋮</strong> in alto).</li>
                <li>Scegli <strong>«Installa app»</strong> oppure <strong>«Aggiungi a schermata Home»</strong>.</li>
                <li>Conferma: l'icona dei baffi comparirà tra le tue app.</li>
              </ol>
            )}
            <button onClick={() => setAiuto(false)} style={{ ...btnPrimarySt, marginTop: 20 }}>Ho capito</button>
          </div>
        </div>
      )}
    </>
  );
}

// «Condividila con chi vuoi»: apre il foglio di condivisione del telefono (WhatsApp, messaggi…); dove non c'è
// (computer) copia il link. Il link porta alla home dell'app ordini, senza dati personali.
function BottoneCondividi({ stile }: { stile: React.CSSProperties }) {
  const [copiato, setCopiato] = useState(false);
  const clic = async () => {
    const url = `${window.location.origin}/ordina`;
    const dati = { title: "Don Basilico", text: "Ordina la pizza di Don Basilico: ritiro in sede o consegna a domicilio.", url };
    try {
      if (navigator.share) { await navigator.share(dati); return; }
    } catch (e: any) {
      if (e?.name === "AbortError") return; // l'utente ha chiuso il foglio di condivisione
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2500);
    } catch {
      window.prompt("Copia il link e mandalo a chi vuoi:", url);
    }
  };
  return (
    <button type="button" onClick={clic} style={{ ...stile, gridColumn: "1 / -1" }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.6l6.8-4M8.6 13.4l6.8 4" /></svg>
      {copiato ? "Link copiato!" : "Condividila con chi vuoi"}
    </button>
  );
}

const senzaMarca = (nome: string) => String(nome ?? "").replace(/^Don Basilico\s+/i, "");
const nomeSedeBreve = (sd: any) => {
  let n = senzaMarca(sd.nome);
  const c = String(sd.citta ?? "");
  if (c && n.toLowerCase().startsWith(c.toLowerCase() + " ")) n = n.slice(c.length + 1);
  return n || String(sd.nome);
};

// Intestazione delle schermate interne: indietro rotondo, logo piccolo, (carrello con badge).
function IntestazioneInterna({ onIndietro, carrello }: { onIndietro: () => void; carrello?: { n: number; onClick: () => void } }) {
  return (
    <header style={{ display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", padding: "0 0 8px" }}>
      <button type="button" aria-label="Indietro" onClick={onIndietro} style={{
        width: 44, height: 44, borderRadius: "50%", border: "1px solid #DADBD2", background: "#FFFFFF", color: "#1B1E17",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 0, cursor: "pointer",
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M11 18l-6-6 6-6" /></svg>
      </button>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <img src="/brand/don-basilico-logo.png" alt="Don Basilico" style={{ width: 104, height: "auto", display: "block" }} />
      </div>
      {carrello ? (
        <button type="button" aria-label={`Carrello, ${carrello.n} ${carrello.n === 1 ? "articolo" : "articoli"}`} onClick={carrello.onClick} style={{
          width: 44, height: 44, borderRadius: "50%", border: "none", background: "#1B1E17", color: "#FFFFFF",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 0, position: "relative", cursor: "pointer",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></svg>
          {carrello.n > 0 && (
            <span style={{ position: "absolute", top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, background: "#7ECE25", color: "#1B1E17", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{carrello.n}</span>
          )}
        </button>
      ) : <span />}
    </header>
  );
}

// Etichetta con pallino verde sopra il titolo («CONSEGNA A DOMICILIO» / «RITIRO IN SEDE»).
function EtichettaPercorso({ testo }: { testo: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, letterSpacing: 2, color: "#4E6B1C" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7ECE25" }} />{testo}
    </span>
  );
}

// CTA fissa in basso: nera, alta 56px (grigia se non attiva).
function BarraCta({ attivo, onClick, children, freccia = true }: { attivo: boolean; onClick: () => void; children: React.ReactNode; freccia?: boolean }) {
  return (
    <div style={{ position: "sticky", bottom: 0, margin: "auto -16px 0", padding: "14px 16px 20px", background: "#F6F6F1", borderTop: "1px solid #E4E5DD", zIndex: 30 }}>
      <button type="button" disabled={!attivo} aria-disabled={!attivo} onClick={onClick} style={{
        width: "100%", height: 56, border: "none", borderRadius: 18, fontSize: 17, fontWeight: 600, fontFamily: "var(--font-ui)",
        background: attivo ? "#1B1E17" : "#D9DAD2", color: attivo ? "#FFFFFF" : "#5F6457", cursor: attivo ? "pointer" : "not-allowed",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        {children}
        {attivo && freccia && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>}
      </button>
    </div>
  );
}

function SchedaSede({ sd, nome, selezionata, onScegli, compatta }: { sd: any; nome: string; selezionata: boolean; onScegli: () => void; compatta?: boolean }) {
  const sospesa = sd.ordiniOnlineAttivi === false;
  return (
    <button type="button" aria-pressed={selezionata} disabled={sospesa} onClick={onScegli} style={{
      minHeight: 66, borderRadius: 18, background: "#FFFFFF", color: "#1B1E17", textAlign: "left", fontFamily: "var(--font-ui)",
      border: selezionata ? "2px solid #1B1E17" : "1px solid #E4E5DD", padding: selezionata ? (compatta ? "0 13px" : "0 15px") : (compatta ? "0 14px" : "0 16px"),
      display: "flex", alignItems: "center", gap: 12, cursor: sospesa ? "default" : "pointer", opacity: sospesa ? 0.6 : 1,
    }}>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, padding: "10px 0" }}>
        <span style={{ fontSize: compatta ? 16 : 17, fontWeight: 600 }}>{nome}</span>
        <span style={{ fontSize: compatta ? 13 : 14, color: "#5F6457" }}>{sd.indirizzo}</span>
        {sospesa && <span style={{ fontSize: 12.5, color: "#B3261E", marginTop: 2 }}>Ordini online sospesi al momento: riprova tra poco o chiamaci</span>}
      </span>
      {!compatta && (
        <span style={{ width: 22, height: 22, borderRadius: "50%", boxSizing: "border-box", flexShrink: 0, background: selezionata ? "#7ECE25" : "transparent", border: selezionata ? "none" : "1.5px solid #A5A99C", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {selezionata && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1B1E17" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>}
        </span>
      )}
    </button>
  );
}

// Prezzo come si legge nel menù: «8» oppure «8,50», senza il simbolo €.
function prezzoMenu(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
}

function euro(n: number) {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

const fmtOrario = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

interface Cliente { id: string; nome: string; telefono: string | null; privacyOk?: boolean; }
interface Tessera { token: string; timbri: number; totaleCiclo: number; scontoDisponibile: boolean; importoSconto: number; }
const TIMBRI_PER_CICLO = 5;
interface IngredienteCl {
  id: string; nome: string; prezzoAggiunta: number | string;
  disabilitatoInSede?: boolean; escludiCompensazione?: boolean;
}
interface ImpastoCl { id: string; nome: string; descrizione: string | null; supplemento: number; }
// Gli impasti speciali si scelgono su pizze e focacce (non su calzoni, fritti, bevande).
const CAT_IMPASTO = ["menu_speciale", "pizze_rosse", "pizze_bianche", "focacce"];

interface CartItem {
  impasto?: { id: string; nome: string; supplemento: number };
  cartId: string; menuItemId: string; nome: string; categoria: string;
  prezzo: number; qty: number;
  rimossi: { id: string; nome: string }[];
  aggiunti: { id: string; nome: string }[];
  nota: string;
}
interface SlotCl { ora: string; iso: string; pieno: boolean; }
interface SlotData {
  apertura: string; chiusura: string; apertoOra: boolean;
  primoGiorno: "oggi" | "domani"; oggi: SlotCl[]; domani: SlotCl[];
}

// Categorie che aprono la finestra di personalizzazione (e che pesano sulla capienza cucina).
const CAT_PIZZA = ["menu_speciale", "pizze_rosse", "pizze_bianche", "calzoni"];
// Ordine delle sezioni del menù: speciali, rosse, bianche, calzoni, fritti, dolci, bevande.
const ORDINE_CAT = ["menu_speciale", "pizze", "pizze_rosse", "pizze_bianche", "calzoni", "focacce", "fritti", "dolci", "bevande", "extra"];
const posCat = (c: string) => { const i = ORDINE_CAT.indexOf(c); return i < 0 ? ORDINE_CAT.length : i; };
const num = (v: number | string | undefined) => parseFloat(String(v ?? 0)) || 0;

// Finestra di personalizzazione pizza: toglie ingredienti base, aggiunge extra.
// Stessa regola della cassa: togliere non genera sconto da solo, ma "copre" fino al
// suo valore gli extra aggiunti (mozzarella/pomodoro e simili non danno credito).
function PizzaModalCliente({ item, ingredienti, impasti, onConferma, onChiudi }: {
  item: any; ingredienti: IngredienteCl[]; impasti: ImpastoCl[];
  onConferma: (c: Omit<CartItem, "cartId">) => void; onChiudi: () => void;
}) {
  const base: IngredienteCl[] = (item.ingredienti ?? []).map((ii: any) => ii.ingrediente ?? ii);
  const [rimossi, setRimossi] = useState<Set<string>>(new Set());
  const [aggiunti, setAggiunti] = useState<Map<string, IngredienteCl>>(new Map());
  const [nota, setNota] = useState("");
  const [qty, setQty] = useState(1);
  const [cerca, setCerca] = useState("");
  const [tuttiIng, setTuttiIng] = useState(false);
  const [impastoId, setImpastoId] = useState<string | null>(null);
  const inizioSwipe = useRef<number | null>(null);
  const impastiScelta = CAT_IMPASTO.includes(item.categoria) ? impasti : [];
  const impastoScelto = impastiScelta.find((x) => x.id === impastoId) ?? null;

  const prezzoBase = num(item.prezzoEffettivo ?? item.prezzoBase);
  const lordo = Array.from(aggiunti.values()).reduce((a, i) => a + num(i.prezzoAggiunta), 0);
  const credito = base.filter((i) => rimossi.has(i.id) && !i.escludiCompensazione).reduce((a, i) => a + num(i.prezzoAggiunta), 0);
  const unitario = prezzoBase + Math.max(0, lordo - credito) + (impastoScelto?.supplemento ?? 0);

  const extra = ingredienti.filter((i) => !rimossi.has(i.id) && !i.disabilitatoInSede
    && i.nome.toLowerCase().includes(cerca.toLowerCase()));
  // Senza ricerca si mostrano i primi 6 (più quelli già scelti); «Mostra tutti» o la ricerca li aprono.
  const extraVisibili = tuttiIng || cerca.trim() ? extra : extra.filter((i, idx) => idx < 6 || aggiunti.has(i.id));
  const nascosti = extra.length - extraVisibili.length;

  const toggle = <T,>(set: Set<T>, v: T) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); return n; };
  const nomiRimossi = base.filter((i) => rimossi.has(i.id)).map((i) => i.nome);
  const nomiAggiunti = Array.from(aggiunti.values()).map((i) => i.nome);
  const etichetta: React.CSSProperties = { margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: 1.8, textTransform: "uppercase" };
  const piu = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
  const meno = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>;
  const spunta = (colore: string, w = 16, sw = 3) => <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={colore} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,30,23,0.55)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={onChiudi}>
      <section role="dialog" aria-modal="true" aria-label={item.nome} onClick={(e) => e.stopPropagation()}
        style={{ background: "#F6F6F1", borderRadius: "28px 28px 0 0", maxHeight: "94vh", display: "flex", flexDirection: "column", width: "100%", maxWidth: 560, margin: "0 auto", overflow: "hidden", fontFamily: "var(--font-ui)", color: "#1B1E17" }}>
        <div
          onTouchStart={(e) => { inizioSwipe.current = e.touches[0].clientY; }}
          onTouchEnd={(e) => { if (inizioSwipe.current !== null && e.changedTouches[0].clientY - inizioSwipe.current > 80) onChiudi(); inizioSwipe.current = null; }}>
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 10 }}><span style={{ width: 40, height: 5, borderRadius: 3, background: "#C9CBC1" }} /></div>
          <div style={{ padding: "8px 20px 0", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <h2 style={{ margin: 0, fontFamily: "'Playfair Display', var(--font-display)", fontWeight: 800, fontSize: 28, lineHeight: 1.1 }}>{item.nome}</h2>
              {item.descrizione && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4, color: "#5F6457" }}>{item.descrizione}</p>}
              <span className="num" style={{ fontSize: 15, fontWeight: 600, color: "#3E4237" }}>{prezzoMenu(prezzoBase)}</span>
            </div>
            <button type="button" aria-label="Chiudi" onClick={onChiudi} style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid #DADBD2", background: "#FFFFFF", color: "#1B1E17", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flex: "none", cursor: "pointer" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "4px 0 12px" }}>
          {item.immagineUrl && (
            <div style={{ padding: "14px 20px 0" }}>
              <img src={item.immagineUrl} alt="" decoding="async" style={{ width: "100%", height: 180, objectFit: "cover", display: "block", borderRadius: 18, background: "var(--border)" }} />
            </div>
          )}

          {impastiScelta.length > 0 && (
            <fieldset style={{ margin: 0, border: "none", padding: "22px 20px 0" }}>
              <legend style={{ ...etichetta, padding: 0, marginBottom: 10 }}>Impasto</legend>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[{ id: null as string | null, nome: "Classico", sub: "incluso" }, ...impastiScelta.map((x) => ({ id: x.id as string | null, nome: x.nome, sub: `+${euro(x.supplemento)}` }))].map((o) => {
                  const on = impastoId === o.id;
                  return (
                    <button key={o.id ?? "classico"} type="button" aria-pressed={on} onClick={() => setImpastoId(o.id)} style={{
                      minHeight: 52, borderRadius: 14, padding: "6px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, textAlign: "left", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 15,
                      border: on ? "2px solid #1B1E17" : "1px solid #DADBD2", background: on ? "#1B1E17" : "#FFFFFF", color: on ? "#FFFFFF" : "#1B1E17", fontWeight: on ? 600 : 400,
                    }}>
                      <span style={{ minWidth: 0 }}>{o.nome}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: on ? "#7ECE25" : "#5F6457", whiteSpace: "nowrap" }}>{o.sub}</span>
                    </button>
                  );
                })}
              </div>
              {impastoScelto?.descrizione && (
                <div style={{ fontSize: 13.5, color: "#3E4237", marginTop: 10, lineHeight: 1.5 }}>{impastoScelto.descrizione}</div>
              )}
            </fieldset>
          )}

          {base.length > 0 && (
            <div style={{ padding: "24px 20px 0", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h3 style={etichetta}>Ingredienti</h3>
                <span style={{ fontSize: 13, color: "#5F6457" }}>Tocca per togliere</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {base.map((i) => {
                  const tolto = rimossi.has(i.id);
                  return (
                    <button key={i.id} type="button" aria-pressed={!tolto} onClick={() => setRimossi((p) => toggle(p, i.id))} style={{
                      minHeight: 44, borderRadius: 999, padding: "0 14px 0 10px", display: "flex", alignItems: "center", gap: 6, fontSize: 15, cursor: "pointer", fontFamily: "var(--font-ui)",
                      border: tolto ? "1.5px solid #B3261E" : "1px solid #DADBD2", background: tolto ? "#FBEAE8" : "#FFFFFF", color: tolto ? "#8C1D18" : "#1B1E17", fontWeight: tolto ? 500 : 400,
                    }}>
                      {tolto
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                        : spunta("#3F7A0E")}
                      <span style={{ textDecoration: tolto ? "line-through" : "none" }}>{i.nome}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ padding: "24px 20px 0", display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={etichetta}>Aggiungi</h3>
            <div style={{ position: "relative" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5F6457" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 16, top: 16 }} aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
              <input type="search" aria-label="Cerca ingrediente" placeholder="Cerca ingrediente…" value={cerca} onChange={(e) => setCerca(e.target.value)}
                style={{ width: "100%", height: 50, boxSizing: "border-box", borderRadius: 16, border: "1px solid #DADBD2", background: "#FFFFFF", padding: "0 16px 0 44px", fontSize: 16, color: "#1B1E17", fontFamily: "var(--font-ui)", outline: "none" }} />
            </div>
            {extraVisibili.length > 0 && (
              <div style={{ background: "#FFFFFF", border: "1px solid #E4E5DD", borderRadius: 20, overflow: "hidden" }}>
                {extraVisibili.map((i, idx) => {
                  const on = aggiunti.has(i.id);
                  const prezzoExtra = num(i.prezzoAggiunta);
                  return (
                    <div key={i.id} style={{ minHeight: 52, padding: "0 6px 0 16px", display: "flex", alignItems: "center", gap: 10, background: on ? "#F3F9EA" : "#FFFFFF", borderBottom: idx < extraVisibili.length - 1 ? "1px solid #EEEEE8" : "none" }}>
                      <span style={{ flex: 1, fontSize: 16, fontWeight: on ? 600 : 400 }}>{i.nome}</span>
                      <span className="num" style={{ fontSize: 14, color: prezzoExtra > 0 ? (on ? "#1B1E17" : "#5F6457") : "#3F7A0E" }}>{prezzoExtra > 0 ? `+${euro(prezzoExtra)}` : "gratis"}</span>
                      <button type="button" aria-pressed={on} aria-label={`${on ? "Togli" : "Aggiungi"} ${i.nome}`}
                        onClick={() => setAggiunti((p) => { const n = new Map(p); on ? n.delete(i.id) : n.set(i.id, i); return n; })}
                        style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, cursor: "pointer", border: on ? "none" : "1px solid #DADBD2", background: on ? "#7ECE25" : "#FFFFFF", color: "#1B1E17" }}>
                        {on ? spunta("currentColor", 18) : piu}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {extra.length === 0 && <div style={{ fontSize: 14, color: "#5F6457" }}>Nessun ingrediente trovato.</div>}
            {!tuttiIng && !cerca.trim() && nascosti > 0 && (
              <button type="button" onClick={() => setTuttiIng(true)} style={{ height: 48, borderRadius: 14, border: "1px solid #DADBD2", background: "#FFFFFF", color: "#1B1E17", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
                Mostra tutti gli ingredienti
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </button>
            )}
          </div>

          <div style={{ padding: "20px 20px 0", display: "flex", flexDirection: "column", gap: 12 }}>
            {(() => {
              const al = allergeniProdotto(item, { rimossi, aggiunti: Array.from(aggiunti.values()) as any[] });
              return (
                <div style={{ padding: "12px 14px", background: "#FFFFFF", border: "1px solid #E4E5DD", borderRadius: 16, fontSize: 13.5, color: "#3E4237", lineHeight: 1.5 }}>
                  <strong style={{ color: "#1B1E17" }}>Allergeni di {item.categoria === "focacce" ? "questa focaccia" : "questa pizza"}:</strong> {testoAllergeni(al)}
                  {al.daConfermare && <div style={{ color: "#5F6457", marginTop: 2 }}>Elenco da confermare: chiedi al personale prima di ordinare.</div>}
                </div>
              );
            })()}
            <textarea style={{ width: "100%", boxSizing: "border-box", resize: "none", borderRadius: 16, border: "1px solid #DADBD2", background: "#FFFFFF", padding: "12px 16px", fontSize: 16, color: "#1B1E17", fontFamily: "var(--font-ui)", outline: "none" }}
              rows={2} placeholder={`Note per ${item.categoria === "focacce" ? "questa focaccia" : "questa pizza"} (opzionale)`} value={nota} onChange={(e) => setNota(e.target.value)} />
          </div>
        </div>

        <div style={{ background: "#FFFFFF", borderTop: "1px solid #E4E5DD", padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {(nomiRimossi.length > 0 || nomiAggiunti.length > 0) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 13 }}>
              {nomiRimossi.map((n) => <span key={"r" + n} style={{ borderRadius: 999, background: "#FBEAE8", color: "#8C1D18", padding: "4px 10px", fontWeight: 500 }}>Senza {n.toLowerCase()}</span>)}
              {nomiAggiunti.map((n) => <span key={"a" + n} style={{ borderRadius: 999, background: "#EEF6E2", color: "#2D4A0B", padding: "4px 10px", fontWeight: 500 }}>+ {n}</span>)}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ height: 56, borderRadius: 18, border: "1px solid #DADBD2", background: "#FFFFFF", display: "flex", alignItems: "center", padding: "0 4px" }}>
              <button type="button" aria-label="Diminuisci quantità" onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 44, height: 44, border: "none", background: "transparent", color: "#1B1E17", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, cursor: "pointer" }}>{meno}</button>
              <span className="num" style={{ minWidth: 20, textAlign: "center", fontSize: 17, fontWeight: 600 }}>{qty}</span>
              <button type="button" aria-label="Aumenta quantità" onClick={() => setQty((q) => q + 1)} style={{ width: 44, height: 44, border: "none", background: "transparent", color: "#1B1E17", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, cursor: "pointer" }}>{piu}</button>
            </span>
            <button type="button" style={{ flex: 1, height: 56, border: "none", borderRadius: 18, background: "#1B1E17", color: "#FFFFFF", fontSize: 17, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", cursor: "pointer", fontFamily: "var(--font-ui)" }}
              onClick={() => onConferma({
                menuItemId: item.id, nome: item.nome, categoria: item.categoria, prezzo: unitario, qty,
                rimossi: base.filter((i) => rimossi.has(i.id)).map((i) => ({ id: i.id, nome: i.nome })),
                aggiunti: Array.from(aggiunti.values()).map((i) => ({ id: i.id, nome: i.nome })),
                nota: nota.trim(),
                impasto: impastoScelto ? { id: impastoScelto.id, nome: impastoScelto.nome, supplemento: impastoScelto.supplemento } : undefined,
              })}>
              <span>Aggiungi</span><span className="num">{euro(unitario * qty)}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function OrdinaFlowInner({ sedeSlugIniziale, onSchermataIniziale }: { sedeSlugIniziale?: string; onSchermataIniziale?: (modo: ModoLogo) => void }) {
  const [caricamento, setCaricamento] = useState(true);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [staffBeta, setStaffBeta] = useState(false);

  // Gate OTP
  const [passoGate, setPassoGate] = useState<"telefono" | "codice">("telefono");
  const [telefono, setTelefono] = useState("");
  const [nome, setNome] = useState("");
  const [codice, setCodice] = useState("");
  const [vistaOrdini, setVistaOrdini] = useState(false);
  const [vistaTessera, setVistaTessera] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [tessera, setTessera] = useState<Tessera | null>(null);
  // Sconto fedeltà: null = il cliente non ha ancora scelto, true = lo usa su questo ordine, false = lo tiene per un altro.
  const [usaSconto, setUsaSconto] = useState<boolean | null>(null);
  const [inviandoOtp, setInviandoOtp] = useState(false);
  const [erroreGate, setErroreGate] = useState("");

  // Flusso ordine
  const [sedi, setSedi] = useState<any[]>([]);
  const [tipo, setTipo] = useState<"asporto" | "domicilio" | null>(null);
  const [sedeSelezionata, setSedeSelezionata] = useState<string>("");
  // Indirizzo in campi separati: la città obbligatoria evita ambiguità (es. "Via Dante 36" esiste a Pescara, Montesilvano e Chieti).
  const [via, setVia] = useState("");
  const [civico, setCivico] = useState("");
  const [cittaConsegna, setCittaConsegna] = useState("");
  const [cap, setCap] = useState("");
  const indirizzo = `${via.trim()} ${civico.trim()}, ${cap.trim() ? cap.trim() + " " : ""}${cittaConsegna}`.trim();
  const [statoIndirizzo, setStatoIndirizzo] = useState<"idle" | "verificando" | "ok" | "errore">("idle");
  const [sedeAssegnata, setSedeAssegnata] = useState<{ id: string; nome: string } | null>(null);
  const [erroreIndirizzo, setErroreIndirizzo] = useState("");

  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [catFiltro, setCatFiltro] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [metodoPagamento, setMetodoPagamento] = useState<"contanti" | "carta" | "">("");
  const [note, setNote] = useState("");
  const [invio, setInvio] = useState(false);
  const [erroreInvio, setErroreInvio] = useState("");
  const [confermato, setConfermato] = useState<{ numeroOrdine: number; sede: string; totale: number; oraRitiro: string | null; scontoFedelta?: number } | null>(null);
  const [nomeCitofono, setNomeCitofono] = useState("");
  const [ingredienti, setIngredienti] = useState<IngredienteCl[]>([]);
  const [impasti, setImpasti] = useState<ImpastoCl[]>([]);
  const [pizzaModal, setPizzaModal] = useState<any>(null);
  const [slotData, setSlotData] = useState<SlotData | null>(null);
  const [orario, setOrario] = useState<string>(""); // "asap" oppure ISO dello slot scelto
  const [giornoSlot, setGiornoSlot] = useState<"oggi" | "domani">("oggi");
  // Il riepilogo (carrello + orario + pagamento) scorre insieme al menù, in fondo alla pagina;
  // la barretta in basso serve solo a raggiungerlo e sparisce quando è già visibile.
  const riepilogoRef = useRef<HTMLDivElement | null>(null);
  const [riepilogoVisibile, setRiepilogoVisibile] = useState(false);
  const [domandaAperta, setDomandaAperta] = useState<string | null>(null);
  const [domandeFatte, setDomandeFatte] = useState<string[]>([]);
  const categorieRef = useRef<HTMLDivElement>(null);
  const [sedeScelta, setSedeScelta] = useState("");   // sede evidenziata nella scelta (si conferma con «Continua»)
  const [toccati, setToccati] = useState<Record<string, boolean>>({});

  // Ricorda l'ultima sede e l'ultimo indirizzo usati su questo telefono, per precompilarli.
  useEffect(() => {
    try {
      const ultimaSede = localStorage.getItem("db_ultima_sede");
      if (ultimaSede) setSedeScelta((x) => x || ultimaSede);
      const a = JSON.parse(localStorage.getItem("db_ultimo_indirizzo") ?? "null");
      if (a && typeof a === "object") {
        setCittaConsegna((x) => x || a.citta || ""); setVia((x) => x || a.via || ""); setCivico((x) => x || a.civico || "");
        setCap((x) => x || a.cap || ""); setNomeCitofono((x) => x || a.citofono || "");
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/ordina/sessione").then((r) => r.json()).then((d) => { setCliente(d.cliente ?? null); setStaffBeta(!!d.staff); setCaricamento(false); });
    fetch("/api/sedi").then((r) => r.json()).then((d) => setSedi(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (sedeSlugIniziale && sedi.length) {
      const s = sedi.find((s) => s.slug === sedeSlugIniziale);
      if (s) { setTipo("asporto"); setSedeSelezionata(s.id); }
    }
  }, [sedeSlugIniziale, sedi]);

  const sedeIdAttiva = tipo === "asporto" ? sedeSelezionata : sedeAssegnata?.id ?? "";

  useEffect(() => {
    if (!sedeIdAttiva) { setMenuItems([]); return; }
    fetch(`/api/menu?sedeId=${sedeIdAttiva}`).then((r) => r.json()).then((d) =>
      setMenuItems((d.items ?? []).filter((i: any) => i.isAttivo && i.disponibileInSede !== false)));
    fetch(`/api/ingredienti?sedeId=${sedeIdAttiva}`).then((r) => r.json()).then((d) =>
      setIngredienti(Array.isArray(d) ? d : []));
  }, [sedeIdAttiva]);

  // Impasti speciali che questa pizzeria prepara (se non ne ha, la scheda della pizza non mostra la scelta).
  useEffect(() => {
    if (!sedeIdAttiva) { setImpasti([]); return; }
    fetch(`/api/impasti?sedeId=${sedeIdAttiva}`).then((r) => r.json()).then((d) => setImpasti(d.impasti ?? [])).catch(() => setImpasti([]));
  }, [sedeIdAttiva]);

  // Peso del carrello sulla cucina (pizze equivalenti) e orari prenotabili con disponibilità.
  const pesoCarrello = cart.reduce((a, c) => a + (CAT_PIZZA.includes(c.categoria) ? c.qty : 0), 0);
  useEffect(() => {
    if (!sedeIdAttiva) { setSlotData(null); return; }
    let annullato = false;
    fetch(`/api/ordina/slot?sedeId=${sedeIdAttiva}&peso=${Math.max(1, pesoCarrello)}`)
      .then((r) => r.json())
      .then((d: SlotData & { error?: string }) => {
        if (annullato || d.error) return;
        setSlotData(d);
        setGiornoSlot((g) => (d.apertoOra ? g : d.primoGiorno));
        // Con la sede chiusa "appena possibile" non esiste: si deve scegliere un orario.
        setOrario((o) => (!d.apertoOra && o === "asap" ? "" : o === "" && d.apertoOra ? "asap" : o));
      })
      .catch(() => {});
    return () => { annullato = true; };
  }, [sedeIdAttiva, pesoCarrello]);

  useEffect(() => {
    const el = riepilogoRef.current;
    if (!el) { setRiepilogoVisibile(false); return; }
    const obs = new IntersectionObserver(([e]) => setRiepilogoVisibile(e.isIntersecting), { threshold: 0.05 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [cart.length, cliente, tipo, sedeSelezionata, statoIndirizzo, confermato]);

  const entraComeStaff = async () => {
    setErroreGate("");
    const res = await fetch("/api/ordina/sessione/staff", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErroreGate(data.error ?? "Non riesco a entrare in modalità prova"); return; }
    setCliente(data.cliente);
  };

  const richiediOtp = async () => {
    setErroreGate("");
    if (!telefono.trim() || !nome.trim()) { setErroreGate("Inserisci nome e telefono"); return; }
    if (!privacy) { setErroreGate("Per continuare devi accettare l'informativa privacy"); return; }
    setInviandoOtp(true);
    const res = await fetch("/api/ordina/otp/richiedi", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telefono }),
    });
    setInviandoOtp(false);
    const data = await res.json();
    if (!res.ok) { setErroreGate(data.error ?? "Errore, riprova"); return; }
    setPassoGate("codice");
  };

  const verificaOtp = async () => {
    setErroreGate("");
    if (!codice.trim()) { setErroreGate("Inserisci il codice ricevuto via SMS"); return; }
    setInviandoOtp(true);
    const res = await fetch("/api/ordina/otp/verifica", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telefono, codice, nome, privacy, marketing }),
    });
    setInviandoOtp(false);
    const data = await res.json();
    if (!res.ok) { setErroreGate(data.error ?? "Codice non valido"); return; }
    setCliente(data.cliente);
  };

  const verificaIndirizzo = async () => {
    setErroreIndirizzo("");
    setSedeAssegnata(null);
    if (!cittaConsegna) { setStatoIndirizzo("errore"); setErroreIndirizzo("Scegli la città"); return; }
    if (!via.trim()) { setStatoIndirizzo("errore"); setErroreIndirizzo("Inserisci la via"); return; }
    if (!civico.trim()) { setStatoIndirizzo("errore"); setErroreIndirizzo("Inserisci il numero civico"); return; }
    if (cap.trim() && !/^\d{5}$/.test(cap.trim())) { setStatoIndirizzo("errore"); setErroreIndirizzo("Il CAP deve avere 5 cifre (oppure lascialo vuoto)"); return; }
    setStatoIndirizzo("verificando");
    const res = await fetch("/api/ordina/copertura", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ indirizzo }),
    });
    const data = await res.json();
    if (data.coperto) {
      setSedeAssegnata({ id: data.sedeId, nome: data.sedeNome });
      setStatoIndirizzo("ok");
      try { localStorage.setItem("db_ultimo_indirizzo", JSON.stringify({ citta: cittaConsegna, via: via.trim(), civico: civico.trim(), cap: cap.trim(), citofono: nomeCitofono })); } catch {}
    } else {
      setStatoIndirizzo("errore");
      setErroreIndirizzo(data.motivo ?? "Indirizzo non coperto");
    }
  };

  const aggiungiAlCarrello = (item: any) => {
    // Pizze, calzoni e focacce si personalizzano nel modale (la focaccia per la scelta dell'impasto); il peso in cucina resta solo delle pizze.
    if (CAT_PIZZA.includes(item.categoria) || item.categoria === "focacce") { setPizzaModal(item); return; }
    const prezzo = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
    setCart((prev) => {
      const ex = prev.find((c) => c.menuItemId === item.id && !c.rimossi.length && !c.aggiunti.length && !c.nota);
      if (ex) return prev.map((c) => c.cartId === ex.cartId ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { cartId: crypto.randomUUID(), menuItemId: item.id, nome: item.nome, categoria: item.categoria, prezzo, qty: 1, rimossi: [], aggiunti: [], nota: "" }];
    });
  };

  // Tessera fedeltà del cliente collegato (timbri e sconto maturato).
  useEffect(() => {
    if (!cliente?.privacyOk) { setTessera(null); return; }
    fetch("/api/ordina/tessera").then((r) => r.json()).then((d) => setTessera(d.tessera ?? null)).catch(() => setTessera(null));
  }, [cliente?.id, cliente?.privacyOk]);

  // Prime schermate (registrazione e scelta ritiro/domicilio): logo grande al centro.
  useEffect(() => {
    if (caricamento) return; // durante il caricamento resta com'è (logo grande), niente salti
    const sulleIniziali = !tipo && !confermato && !vistaOrdini && !vistaTessera;
    const inHome = sulleIniziali && !!cliente && cliente.privacyOk !== false;
    const interna = !!tipo && !confermato && !vistaOrdini && !vistaTessera;
    onSchermataIniziale?.(inHome ? "home" : sulleIniziali ? "grande" : interna ? "nascosto" : "piccolo");
  }, [caricamento, tipo, confermato, vistaOrdini, vistaTessera, cliente, onSchermataIniziale]);

  const subtotale = cart.reduce((a, c) => a + c.prezzo * c.qty, 0);
  const consegna = tipo === "domicilio" ? COSTO_CONSEGNA_DEFAULT : 0;
  const lordo = subtotale + consegna;
  const scontoMaturato = tessera?.scontoDisponibile ? tessera.importoSconto : 0;
  // Lo sconto si applica ai prodotti: la consegna resta sempre da pagare e non conta per la tessera.
  const scontoApplicato = usaSconto === true ? Math.min(scontoMaturato, subtotale) : 0;
  const totale = lordo - scontoApplicato;
  // Se lo sconto sta nel totale lo si propone già attivo; se lo supera il cliente deve scegliere lui (si perderebbe il resto).
  useEffect(() => {
    if (scontoMaturato > 0 && usaSconto === null && subtotale >= scontoMaturato) setUsaSconto(true);
  }, [scontoMaturato, subtotale, usaSconto]);

  const inviaOrdine = async () => {
    setErroreInvio("");
    if (!cart.length) { setErroreInvio("Il carrello è vuoto"); return; }
    // Se è arrivato qui senza passare dal «Vai al riepilogo» (lista corta, scroll a mano), le domande su fritti e bevande si fanno ora.
    const domanda = prossimaDomanda(domandeFatte);
    if (domanda) { setDomandaAperta(domanda); return; }
    if (tipo === "domicilio" && !metodoPagamento) { setErroreInvio("Scegli come pagare"); return; }
    if (!orario) { setErroreInvio("Scegli l'orario di ritiro"); return; }
    if (scontoMaturato > 0 && usaSconto === null) { setErroreInvio("Scegli se usare ora lo sconto fedeltà"); return; }
    setInvio(true);
    const sedeAsporto = sedi.find((s) => s.id === sedeSelezionata);
    try {
      const res = await fetch("/api/ordina/conferma", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          clienteIndirizzo: tipo === "domicilio" ? indirizzo : undefined,
          sedeSlugAsporto: tipo === "asporto" ? sedeAsporto?.slug : undefined,
          metodoPagamento: tipo === "domicilio" ? metodoPagamento : undefined,
          nomeCitofono: tipo === "domicilio" ? nomeCitofono || undefined : undefined,
          oraRitiro: orario === "asap" ? undefined : orario,
          usaSconto: scontoMaturato > 0 && usaSconto === true,
          note: note || undefined,
          articoli: cart.map((c) => ({
            menuItemId: c.menuItemId, quantita: c.qty,
            ingredientiAggiuntiIds: c.aggiunti.map((i) => i.id),
            ingredientiRimossi: c.rimossi.map((i) => i.id),
            impastoId: c.impasto?.id,
            note: c.nota || undefined,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErroreInvio(data.error ?? "Non siamo riusciti a inviare l'ordine, riprova tra un momento"); return; }
      setConfermato({ numeroOrdine: data.numeroOrdine, sede: data.sede, totale: data.totale, oraRitiro: data.oraRitiro, scontoFedelta: data.scontoFedelta });
    } catch {
      setErroreInvio("Connessione assente o server non raggiungibile, riprova");
    } finally {
      setInvio(false);
    }
  };

  if (caricamento) return null;

  // ── La mia tessera ───────────────────────────────────────────
  if (vistaTessera && cliente) {
    return <PaginaTessera sedi={sedi.map((x: any) => ({ slug: x.slug, nome: x.nome }))} onIndietro={() => {
      setVistaTessera(false);
      fetch("/api/ordina/tessera").then((r) => r.json()).then((d) => setTessera(d.tessera ?? null)).catch(() => {});
    }} />;
  }

  // ── I miei ordini ────────────────────────────────────────────
  if (vistaOrdini && cliente) {
    return <MieiOrdini onIndietro={() => { setVistaOrdini(false); setConfermato(null); }} />;
  }

  // ── Conferma finale ──────────────────────────────────────────
  if (confermato) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div style={{
          display: "inline-block", background: "var(--accent-bg-2)", border: "1px solid var(--accent-border)", borderRadius: 20,
          padding: "7px 18px", fontSize: 13, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--text)", marginBottom: 14,
        }}>Ordine in attesa di conferma</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 40, color: "var(--text)" }}>#{confermato.numeroOrdine}</div>
        <div style={{ fontSize: 14, color: "var(--text-2)", marginTop: 10 }}>{confermato.sede}</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--text)", marginTop: 14 }}>{euro(confermato.totale)}</div>
        {!!confermato.scontoFedelta && (
          <div style={{ fontSize: 13.5, color: "var(--accent-ink)", marginTop: 6, fontWeight: 600 }}>Sconto fedeltà applicato: -{euro(confermato.scontoFedelta)}</div>
        )}
        {confermato.oraRitiro && (
          <div style={{ fontSize: 14, color: "var(--text-2)", marginTop: 10 }}>
            {tipo === "domicilio" ? "Consegna richiesta" : "Ritiro richiesto"}: <strong>{fmtOrario(confermato.oraRitiro)}</strong>
          </div>
        )}
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 20, lineHeight: 1.5 }}>
          Abbiamo ricevuto il tuo ordine, ma <strong>non è ancora confermato</strong>: la pizzeria lo sta controllando.
          Riceverai un SMS al {cliente?.telefono ?? "tuo numero"} con l'orario confermato
          {confermato.oraRitiro ? " (potrebbe variare di poco in base agli ordini in corso)" : ""}.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360, margin: "26px auto 0" }}>
          <button style={btnPrimarySt} onClick={() => setVistaOrdini(true)}>Segui il tuo ordine</button>
          <button style={{ ...btnPrimarySt, background: "transparent", color: "var(--text)", border: "1.5px solid var(--text)" }}
            onClick={() => { setConfermato(null); setCart([]); setTipo(null); }}>Torna alla home</button>
        </div>
      </div>
    );
  }

  // ── Gate registrazione/OTP ───────────────────────────────────
  if (!cliente) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 420, width: "100%", margin: "0 auto" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text)", textAlign: "center" }}>Ordina online</h1>
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>Registrati con il tuo numero di telefono: ci serve per confermarti l'ordine e poterti chiamare in caso di problemi in consegna.</p>

        {staffBeta && (
          <div style={{ background: "var(--accent-bg-2)", border: "1px solid var(--accent-border)", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, color: "var(--text)" }}>
              <strong>Sei del team?</strong> Sei collegato al CRM: puoi provare l'ordine online senza codice SMS. L'ordine comparirà nel CRM come "PROVA …": ricordati di annullarlo dopo la prova.
            </div>
            <button style={btnPrimarySt} onClick={entraComeStaff} disabled={inviandoOtp}>Entra in modalità prova (staff)</button>
          </div>
        )}

        {passoGate === "telefono" ? (
          <>
            <input style={fieldSt} placeholder="Il tuo nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            <input style={fieldSt} placeholder="Numero di telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            <ConsensiPrivacy privacy={privacy} setPrivacy={setPrivacy} marketing={marketing} setMarketing={setMarketing} />
            {erroreGate && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{erroreGate}</div>}
            <button style={btnPrimarySt} onClick={richiediOtp} disabled={inviandoOtp}>
              {inviandoOtp ? "Invio…" : "Invia codice via SMS"}
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: "var(--text-2)" }}>Codice inviato a {telefono}</p>
            <input style={fieldSt} placeholder="Codice ricevuto" value={codice} onChange={(e) => setCodice(e.target.value)} />
            {erroreGate && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{erroreGate}</div>}
            <button style={btnPrimarySt} onClick={verificaOtp} disabled={inviandoOtp}>
              {inviandoOtp ? "Verifica…" : "Conferma"}
            </button>
            <button onClick={() => setPassoGate("telefono")} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer" }}>
              Numero sbagliato? Torna indietro
            </button>
          </>
        )}
        <a href="/ordina/menu" style={{ ...btnPrimarySt, display: "block", textAlign: "center", textDecoration: "none", background: "transparent", color: "var(--text)", border: "1.5px solid var(--text)" }}>Consulta il menù</a>
        <BottoneInstalla />
      </div>
    );
  }

  // ── Cliente già registrato che deve ancora accettare l'informativa ──
  if (cliente.privacyOk === false) {
    const accetta = async () => {
      setErroreGate("");
      if (!privacy) { setErroreGate("Per continuare devi accettare l'informativa privacy"); return; }
      const res = await fetch("/api/ordina/privacy", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ privacy, marketing }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErroreGate(d.error ?? "Errore, riprova"); return; }
      setCliente({ ...cliente, privacyOk: true });
    };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 420, width: "100%", margin: "0 auto" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text)", textAlign: "center" }}>Ciao {cliente.nome.split(" ")[0]}</h1>
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>Prima di ordinare, ci serve il tuo consenso al trattamento dei dati.</p>
        <ConsensiPrivacy privacy={privacy} setPrivacy={setPrivacy} marketing={marketing} setMarketing={setMarketing} />
        {erroreGate && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{erroreGate}</div>}
        <button style={btnPrimarySt} onClick={accetta}>Accetta e continua</button>
      </div>
    );
  }

  // ── Scelta ritiro/domicilio ──────────────────────────────────
  if (!tipo) {
    const primoNome = cliente.nome.trim().split(/\s+/)[0] ?? "";
    const saluto = primoNome.charAt(0).toUpperCase() + primoNome.slice(1);
    const freccia = (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
    );
    const cta: React.CSSProperties = {
      height: 214, border: "none", borderRadius: 24, padding: 18, display: "flex", flexDirection: "column",
      justifyContent: "space-between", alignItems: "flex-start", textAlign: "left", cursor: "pointer", fontFamily: "var(--font-ui)",
    };
    const secondario: React.CSSProperties = {
      height: 56, borderRadius: 18, border: "1px solid #DADBD2", background: "#FFFFFF", color: "#1B1E17", fontSize: 16, fontWeight: 500,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", fontFamily: "var(--font-ui)", textDecoration: "none",
    };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 430, width: "100%", margin: "0 auto", padding: "0 4px 12px", color: "#1B1E17" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h1 style={{ margin: 0, fontFamily: "'Playfair Display', var(--font-display)", fontWeight: 800, fontSize: 30, lineHeight: 1.15, letterSpacing: -0.3 }}>Ciao {saluto}</h1>
          <p style={{ margin: 0, fontSize: 16, color: "#555950" }}>Come vuoi la tua pizza oggi?</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button type="button" onClick={() => setTipo("domicilio")} style={{ ...cta, background: "#1B1E17", color: "#FFFFFF" }}>
            <span style={{ width: 52, height: 52, borderRadius: 16, background: "#7ECE25", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1B1E17" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="5.5" cy="17.5" r="2.5" /><circle cx="18.5" cy="17.5" r="2.5" /><path d="M8 17.5h7.5l2-6H13" /><path d="M15 6h2.5l1.5 5.5" /><path d="M3 12h7v3H3z" /></svg>
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.15 }}>Consegna a domicilio</span>
              <span style={{ fontSize: 14, lineHeight: 1.3, color: "#C9CCC2" }}>Calda, direttamente a casa tua</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "#7ECE25" }}>Ordina {freccia}</span>
          </button>

          <button type="button" onClick={() => setTipo("asporto")} style={{ ...cta, background: "#7ECE25", color: "#1B1E17" }}>
            <span style={{ width: 52, height: 52, borderRadius: 16, background: "#1B1E17", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7ECE25" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></svg>
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.15 }}>Ritiro in sede</span>
              <span style={{ fontSize: 14, lineHeight: 1.3, color: "#2D3324" }}>Ordina ora, passi a prenderla tu</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600 }}>Ordina {freccia}</span>
          </button>
        </div>

        <CartaFedelta tessera={tessera} onApri={() => setVistaTessera(true)} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button type="button" onClick={() => setVistaOrdini(true)} style={secondario}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg>
            I miei ordini
          </button>
          <a href="/ordina/menu" style={secondario}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /><path d="M9 8h6" /></svg>
            Il menù
          </a>
          <BottoneCondividi stile={secondario} />
        </div>

        <BottoneInstalla discreto />
      </div>
    );
  }

  if (tipo === "asporto" && !sedeSelezionata) {
    const gruppi: { citta: string; lista: any[] }[] = [];
    sedi.forEach((sd: any) => {
      const c = String(sd.citta ?? "");
      let g = gruppi.find((x) => x.citta === c);
      if (!g) { g = { citta: c, lista: [] }; gruppi.push(g); }
      g.lista.push(sd);
    });
    gruppi.sort((a, b) => b.lista.length - a.lista.length);
    const piene = gruppi.filter((g) => g.lista.length > 1);
    const singole = gruppi.filter((g) => g.lista.length === 1);
    const evidenziata = sedi.find((sd: any) => sd.id === sedeScelta && sd.ordiniOnlineAttivi !== false);
    const etichetta = { fontSize: 12, fontWeight: 600, letterSpacing: 1.5, color: "#5F6457", textTransform: "uppercase" } as React.CSSProperties;
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100dvh - 30px)", maxWidth: 430, width: "100%", margin: "0 auto" }}>
        <IntestazioneInterna onIndietro={() => setTipo(null)} />
        <div style={{ flex: 1, paddingTop: 14, display: "flex", flexDirection: "column", gap: 16, paddingBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <EtichettaPercorso testo="RITIRO IN SEDE" />
            <h1 style={{ margin: 0, fontFamily: "'Playfair Display', var(--font-display)", fontWeight: 800, fontSize: 28, lineHeight: 1.15, color: "#1B1E17" }}>Dove passi a prenderla?</h1>
          </div>
          {piene.map((g) => (
            <div key={g.citta} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={etichetta}>{g.citta}</span>
              {g.lista.map((sd: any) => (
                <SchedaSede key={sd.id} sd={sd} nome={nomeSedeBreve(sd)} selezionata={sedeScelta === sd.id} onScegli={() => setSedeScelta(sd.id)} />
              ))}
            </div>
          ))}
          {singole.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "start" }}>
              {singole.map((g) => (
                <div key={g.citta} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                  <span style={etichetta}>{g.citta}</span>
                  <SchedaSede sd={g.lista[0]} nome={nomeSedeBreve(g.lista[0]) || g.citta} compatta selezionata={sedeScelta === g.lista[0].id} onScegli={() => setSedeScelta(g.lista[0].id)} />
                </div>
              ))}
            </div>
          )}
        </div>
        <BarraCta attivo={!!evidenziata} onClick={() => { if (!evidenziata) return; try { localStorage.setItem("db_ultima_sede", evidenziata.id); } catch {} setSedeSelezionata(evidenziata.id); }}>
          {evidenziata ? `Continua con ${senzaMarca(evidenziata.nome)}` : "Scegli una sede"}
        </BarraCta>
      </div>
    );
  }

  if (tipo === "domicilio" && statoIndirizzo !== "ok") {
    const capValido = !cap.trim() || /^\d{5}$/.test(cap.trim());
    const errCitta = !cittaConsegna ? "Scegli la città" : "";
    const errVia = !via.trim() ? "Inserisci la via" : "";
    const errCivico = !civico.trim() ? "Inserisci il civico" : "";
    const errCap = !capValido ? "Il CAP ha 5 cifre" : "";
    const tutto = !errCitta && !errVia && !errCivico && !errCap;
    const tocca = (k: string) => setToccati((t) => ({ ...t, [k]: true }));
    const campo = (errore: string, k: string): React.CSSProperties => ({
      height: 54, boxSizing: "border-box", width: "100%", minWidth: 0, borderRadius: 16, background: "#FFFFFF", fontSize: 16, color: "#1B1E17", fontFamily: "var(--font-ui)", outline: "none",
      border: errore && toccati[k] ? "2px solid #B3261E" : "1px solid #DADBD2", padding: errore && toccati[k] ? "0 15px" : "0 16px",
    });
    const etichettaCampo = (testo: string, obbligatorio: boolean, facoltativo?: boolean) => (
      <span style={{ fontSize: 14, fontWeight: 500 }}>{testo}{obbligatorio && <span style={{ color: "#B3261E" }}> *</span>}{facoltativo && <span style={{ fontWeight: 400, color: "#5F6457" }}> (facoltativo)</span>}</span>
    );
    const messaggio = (errore: string, k: string) => errore && toccati[k] ? (
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#B3261E" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16.5v.01" /></svg>{errore}
      </span>
    ) : null;
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100dvh - 30px)", maxWidth: 430, width: "100%", margin: "0 auto" }}>
        <IntestazioneInterna onIndietro={() => setTipo(null)} />
        <div style={{ flex: 1, paddingTop: 18, display: "flex", flexDirection: "column", gap: 22, paddingBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <EtichettaPercorso testo="CONSEGNA A DOMICILIO" />
            <h1 style={{ margin: 0, fontFamily: "'Playfair Display', var(--font-display)", fontWeight: 800, fontSize: 28, lineHeight: 1.15, color: "#1B1E17" }}>Dove te la portiamo?</h1>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {etichettaCampo("Città", true)}
              <div style={{ position: "relative" }}>
                <select style={{ ...campo(errCitta, "citta"), padding: "0 44px 0 16px", appearance: "none", WebkitAppearance: "none" } as React.CSSProperties}
                  value={cittaConsegna} onChange={(e) => setCittaConsegna(e.target.value)} onBlur={() => tocca("citta")}>
                  <option value="">Scegli la città</option>
                  {Array.from(new Set(sedi.map((sd: any) => sd.citta as string).filter(Boolean))).sort((a, b) => a.localeCompare(b, "it")).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B1E17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 16, top: 18, pointerEvents: "none" }} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </div>
              {messaggio(errCitta, "citta")}
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {etichettaCampo("Via / piazza", true)}
              <input style={campo(errVia, "via")} placeholder="Es. Viale Marconi" value={via} onChange={(e) => setVia(e.target.value)} onBlur={() => tocca("via")} />
              {messaggio(errVia, "via")}
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                {etichettaCampo("N. civico", true)}
                <input style={campo(errCivico, "civico")} placeholder="Es. 148" value={civico} onChange={(e) => setCivico(e.target.value)} onBlur={() => tocca("civico")} />
                {messaggio(errCivico, "civico")}
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                {etichettaCampo("CAP", false, true)}
                <input style={campo(errCap, "cap")} placeholder="65100" inputMode="numeric" maxLength={5} value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ""))} onBlur={() => tocca("cap")} />
                {messaggio(errCap, "cap")}
              </label>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {etichettaCampo("Nome sul citofono", false)}
              <input style={campo("", "citofono")} placeholder="Così il rider ti trova subito" value={nomeCitofono} onChange={(e) => setNomeCitofono(e.target.value)} />
            </label>
          </div>

          <p style={{ margin: 0, fontSize: 13, color: "#5F6457" }}>* Campi obbligatori</p>
          {statoIndirizzo === "errore" && erroreIndirizzo && (
            <div role="alert" style={{ borderRadius: 16, background: "#FBEAE8", border: "1px solid #F0C4C0", padding: "12px 14px", fontSize: 14, lineHeight: 1.4, color: "#8C1D18" }}>{erroreIndirizzo}</div>
          )}
        </div>
        <BarraCta attivo={tutto && statoIndirizzo !== "verificando"} onClick={verificaIndirizzo} freccia={tutto && statoIndirizzo !== "verificando"}>
          {statoIndirizzo === "verificando" ? "Verifica…" : tutto ? "Continua al menù" : "Compila i campi obbligatori"}
        </BarraCta>
      </div>
    );
  }

  // ── Menù + carrello ──────────────────────────────────────────
  // "Crea la tua pizza" è un prodotto normale del menù (base Margherita a € 6, extra ai prezzi degli
  // ingredienti) ma sul sito ha un pulsante in evidenza e non compare nell'elenco delle pizze.
  const creaItem = menuItems.find((m) => String(m.nome).trim().toLowerCase() === "crea la tua pizza");
  const menuLista = menuItems.filter((m) => m !== creaItem);
  const catsPresenti = Array.from(new Set(menuLista.map((m) => m.categoria as string))).sort((a, b) => posCat(a) - posCat(b));
  const filtro = catFiltro || catsPresenti[0] || "";
  const itemsFiltrati = menuLista.filter((m) => m.categoria === filtro).sort((a, b) => a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }));

  // Premendo «Vai al riepilogo»: se nel carrello non c'è un fritto / una bevanda, prima si chiede (sì → apre quella pagina
  // del menù; no → si passa alla domanda successiva e infine al riepilogo). Ogni domanda si fa una volta sola.
  const DOMANDE: Record<string, { testo: string; sub: string }> = {
    fritti: { testo: "Vuoi aggiungere un fritto da sgranocchiare?", sub: "Olive ascolane, supplì, patatine…" },
    bevande: { testo: "Gradisci qualcosa da bere?", sub: "Acqua, bibite, birra…" },
  };
  const prossimaDomanda = (chiesti: string[]) =>
    (["fritti", "bevande"] as const).find((cat) =>
      !chiesti.includes(cat) && !cart.some((c) => c.categoria === cat) && menuLista.some((m) => m.categoria === cat));
  const vaiAlRiepilogo = () => {
    const cat = prossimaDomanda(domandeFatte);
    if (cat) setDomandaAperta(cat);
    else riepilogoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const rispondiDomanda = (cat: string, si: boolean) => {
    const fatte = [...domandeFatte, cat];
    setDomandeFatte(fatte);
    setDomandaAperta(null);
    if (si) {
      setCatFiltro(cat);
      setTimeout(() => categorieRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return;
    }
    const prossima = prossimaDomanda(fatte);
    if (prossima) setDomandaAperta(prossima);
    else setTimeout(() => riepilogoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  // «−» sulla scheda: toglie un pezzo (l'ultimo aggiunto di quel prodotto); a zero la riga sparisce.
  const togliUno = (menuItemId: string) => setCart((prev) => {
    let idx = -1;
    prev.forEach((c, i) => { if (c.menuItemId === menuItemId) idx = i; });
    if (idx < 0) return prev;
    return prev.map((c, i) => (i === idx ? { ...c, qty: c.qty - 1 } : c)).filter((c) => c.qty > 0);
  });
  const qtaNelCarrello = (id: string) => cart.reduce((a, c) => a + (c.menuItemId === id ? c.qty : 0), 0);
  const catSuggerite = (["fritti", "bevande"] as const)
    .map((cat) => ({
      cat,
      items: menuLista.filter((m) => m.categoria === cat).sort((a, b) => a.nome.localeCompare(b.nome, "it", { sensitivity: "base" })),
    }))
    .filter((g) => g.items.length > 0);

  const nProdotti = cart.reduce((a, c) => a + c.qty, 0);
  const sedeAttiva = sedi.find((sd: any) => sd.id === sedeIdAttiva);
  // «Cambia» (e la freccia indietro del menù): torna alla scelta della sede / dell'indirizzo. Il carrello si svuota perché
  // menù, prezzi e orari dipendono dalla pizzeria.
  const cambiaModalita = () => {
    if (cart.length > 0 && !confirm("Se cambi sede o indirizzo il carrello si svuota, perché menù e prezzi possono cambiare. Vuoi continuare?")) return;
    setCart([]); setOrario(""); setDomandeFatte([]); setDomandaAperta(null);
    if (tipo === "asporto") { setSedeScelta(sedeSelezionata); setSedeSelezionata(""); }
    else { setStatoIndirizzo("idle"); setSedeAssegnata(null); }
  };
  const iconaModalita = tipo === "domicilio"
    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1E17" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} aria-hidden="true"><circle cx="5.5" cy="17.5" r="2.5" /><circle cx="18.5" cy="17.5" r="2.5" /><path d="M8 17.5h7.5l2-6H13" /><path d="M15 6h2.5l1.5 5.5" /></svg>
    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1E17" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></svg>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 430, width: "100%", margin: "0 auto" }}>
      <IntestazioneInterna onIndietro={cambiaModalita} carrello={{ n: nProdotti, onClick: vaiAlRiepilogo }} />

      <div style={{ minHeight: 52, boxSizing: "border-box", borderRadius: 16, background: "#FFFFFF", border: "1px solid #E4E5DD", padding: "6px 8px 6px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        {iconaModalita}
        <span style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.25 }}>
          {tipo === "domicilio" ? (
            <>
              <span style={{ fontWeight: 600 }}>Consegna</span> · {indirizzo}
              {sedeAssegnata && <span style={{ display: "block", fontSize: 12.5, color: "#5F6457" }}>da {senzaMarca(sedeAssegnata.nome)}</span>}
            </>
          ) : (
            <><span style={{ fontWeight: 600 }}>Ritiro</span> · {sedeAttiva ? senzaMarca(sedeAttiva.nome) : ""}</>
          )}
        </span>
        <button type="button" onClick={cambiaModalita} style={{ height: 44, padding: "0 12px", border: "none", borderRadius: 12, background: "transparent", color: "#1B1E17", fontSize: 15, fontWeight: 600, textDecoration: "underline", cursor: "pointer", fontFamily: "var(--font-ui)" }}>Cambia</button>
      </div>

      {slotData && !slotData.apertoOra && (
        <div style={{ borderRadius: 16, background: "#EEF6E2", border: "1px solid #D3E8B5", padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3F5A12" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4, color: "#2D3324" }}>
            <span style={{ fontWeight: 600 }}>Ora siamo chiusi, apriamo alle {slotData.apertura}.</span>{" "}
            Puoi già ordinare e scegliere l'orario di {tipo === "domicilio" ? "consegna" : "ritiro"}.{slotData.primoGiorno === "domani" ? " Gli orari disponibili sono per domani." : ""}
          </p>
        </div>
      )}

      {creaItem && (
        <button type="button" onClick={() => setPizzaModal(creaItem)} style={{
          border: "none", borderRadius: 22, background: "#1B1E17", color: "#FFFFFF", padding: 18, display: "flex", alignItems: "center", gap: 14, textAlign: "left", cursor: "pointer", fontFamily: "var(--font-ui)",
        }}>
          <span style={{ width: 52, height: 52, borderRadius: 16, background: "#7ECE25", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1B1E17" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 3v18" /><path d="M4.5 7.5l15 9" /><circle cx="8.5" cy="13.5" r="1" /><circle cx="15" cy="9" r="1" /></svg>
          </span>
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontFamily: "'Playfair Display', var(--font-display)", fontWeight: 700, fontSize: 20, lineHeight: 1.15 }}>Crea la tua pizza</span>
            <span style={{ fontSize: 14, lineHeight: 1.35, color: "#C9CCC2" }}>Parti da pomodoro e mozzarella e aggiungi gli ingredienti che vuoi</span>
          </span>
          <span style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 12, color: "#C9CCC2" }}>da</span>
            <span className="num" style={{ fontSize: 17, fontWeight: 600, color: "#7ECE25" }}>{euro(parseFloat(creaItem.prezzoEffettivo ?? creaItem.prezzoBase))}</span>
          </span>
        </button>
      )}

      <nav ref={categorieRef} className="db-scroll-x" aria-label="Categorie" style={{ position: "sticky", top: 0, zIndex: 25, background: "#F6F6F1", margin: "0 -16px", padding: "10px 16px", display: "flex", gap: 8, overflowX: "auto", scrollMarginTop: 0 }}>
        {catsPresenti.map((c) => (
          <button key={c} type="button" aria-pressed={filtro === c} onClick={() => setCatFiltro(c)} style={{
            flex: "none", height: 44, padding: "0 18px", borderRadius: 999, fontSize: 15, cursor: "pointer", fontFamily: "var(--font-ui)", whiteSpace: "nowrap",
            border: filtro === c ? "none" : "1px solid #DADBD2", background: filtro === c ? "#1B1E17" : "#FFFFFF",
            color: filtro === c ? "#FFFFFF" : "#1B1E17", fontWeight: filtro === c ? 500 : 400,
          }}>{CAT_LABEL[c] ?? c}</button>
        ))}
      </nav>

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ margin: "4px 0 2px", fontFamily: "'Playfair Display', var(--font-display)", fontWeight: 800, fontSize: 24, color: "#1B1E17" }}>{CAT_LABEL[filtro] ?? filtro}</h2>
        {itemsFiltrati.map((item) => {
          const prezzo = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
          const q = qtaNelCarrello(item.id);
          return (
            <div key={item.id} role="button" tabIndex={0} aria-label={`${item.nome}, ${prezzoMenu(prezzo)}${q ? `, nel carrello: ${q}` : ""}`}
              onClick={() => aggiungiAlCarrello(item)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aggiungiAlCarrello(item); } }}
              style={{ background: "#FFFFFF", border: q ? "1.5px solid #1B1E17" : "1px solid #E4E5DD", borderRadius: 20, padding: 14, cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}>
              {item.immagineUrl && (
                <img src={item.immagineUrl} alt="" loading="lazy" decoding="async"
                  style={{ width: 76, height: 76, borderRadius: 14, objectFit: "cover", flex: "none", background: "var(--border)" }} />
              )}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <h3 style={{ margin: 0, fontFamily: "'Playfair Display', var(--font-display)", fontWeight: 700, fontSize: 19, lineHeight: 1.2, color: "#1B1E17" }}>{item.nome}</h3>
                {item.descrizione && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4, color: "#5F6457" }}>{item.descrizione}</p>}
              </div>
              <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <span className="num" style={{ fontSize: 16, fontWeight: 600, whiteSpace: "nowrap" }}>{prezzoMenu(prezzo)}</span>
                {q > 0 && (
                  <button type="button" aria-label={`Togli uno: ${item.nome} (nel carrello: ${q})`}
                    onClick={(e) => { e.stopPropagation(); togliUno(item.id); }}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{ height: 44, minWidth: 64, margin: "-4px -4px -4px 0", padding: "0 14px", borderRadius: 999, border: "none", background: "#1B1E17", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
                    <span className="num" style={{ fontSize: 15, fontWeight: 600, color: "#7ECE25" }}>{q}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {cart.length > 0 && (
        <div ref={riepilogoRef} style={{ background: "#FFFFFF", border: "1px solid #E4E5DD", borderRadius: 20, padding: 16 }}>
          {cart.map((c) => (
            <div key={c.cartId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: "var(--text)" }}>{c.nome}</div>
                {c.impasto && <div style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 600 }}>Impasto {c.impasto.nome} (+{euro(c.impasto.supplemento)})</div>}
                {c.rimossi.length > 0 && <div style={{ fontSize: 11, color: "var(--danger)" }}>Senza: {c.rimossi.map((i) => i.nome).join(", ")}</div>}
                {c.aggiunti.length > 0 && <div style={{ fontSize: 11, color: "var(--accent-ink)" }}>Con: {c.aggiunti.map((i) => i.nome).join(", ")}</div>}
                {c.nota && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.nota}</div>}
              </div>
              <button onClick={() => setCart((p) => p.map((x) => x.cartId === c.cartId ? { ...x, qty: x.qty - 1 } : x).filter((x) => x.qty > 0))} style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)", background: "#fff", cursor: "pointer" }}>−</button>
              <span className="num" style={{ fontSize: 13, minWidth: 14, textAlign: "center" }}>{c.qty}</span>
              <button onClick={() => setCart((p) => p.map((x) => x.cartId === c.cartId ? { ...x, qty: x.qty + 1 } : x))} style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)", background: "#fff", cursor: "pointer" }}>+</button>
              <span className="num" style={{ fontSize: 13, fontWeight: 500, minWidth: 56, textAlign: "right" }}>{euro(c.prezzo * c.qty)}</span>
            </div>
          ))}

          {catSuggerite.length > 0 && (
            <div style={{ margin: "14px 0 12px", paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontFamily: "'Playfair Display', var(--font-display)", fontWeight: 700, fontSize: 19, color: "var(--text)" }}>Completa il tuo ordine</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, marginBottom: 10 }}>Aggiungi qualcosa da bere o da sgranocchiare</div>
              {catSuggerite.map((g) => (
                <div key={g.cat} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>{CAT_LABEL[g.cat] ?? g.cat}</div>
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                    {g.items.map((m) => {
                      const q = qtaNelCarrello(m.id);
                      return (
                        <div key={m.id} style={{
                          flex: "0 0 138px", background: "#fff", border: `1.5px solid ${q ? "var(--text)" : "var(--border)"}`, borderRadius: 12,
                          padding: 10, display: "flex", flexDirection: "column", gap: 6,
                        }}>
                          {m.immagineUrl && (
                            <img src={m.immagineUrl} alt={m.nome} loading="lazy" decoding="async"
                              style={{ width: "100%", height: 70, borderRadius: 8, objectFit: "cover", background: "var(--border)" }} />
                          )}
                          <div style={{ fontFamily: "var(--font-display)", fontSize: 13.5, color: "var(--text)", lineHeight: 1.25, flex: 1 }}>{m.nome}</div>
                          <div className="num" style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{prezzoMenu(parseFloat(m.prezzoEffettivo ?? m.prezzoBase))}</div>
                          <button onClick={() => aggiungiAlCarrello(m)} style={{
                            padding: "8px 6px", borderRadius: 9, border: "1.5px solid var(--text)", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 500,
                            background: q ? "var(--text)" : "#fff", color: q ? "#fff" : "var(--text)",
                          }}>{q ? `Aggiunto ×${q} · +1` : "+ Aggiungi"}</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <textarea style={{ ...fieldSt, resize: "none", marginTop: 6, marginBottom: 10 } as any} rows={2} placeholder="Note (opzionale)" value={note} onChange={(e) => setNote(e.target.value)} />

          {slotData && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
                {tipo === "domicilio" ? "Orario di consegna" : "Orario di ritiro"}
              </div>
              {slotData.apertoOra && (
                <button onClick={() => setOrario("asap")} style={{
                  width: "100%", marginBottom: 8, padding: "12px", borderRadius: 12, border: "1.5px solid", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13.5,
                  ...sceltaSt(orario === "asap"),
                }}>Appena possibile</button>
              )}
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {(["oggi", "domani"] as const).map((g) => {
                  const disp = slotData[g].length > 0;
                  return (
                    <button key={g} disabled={!disp} onClick={() => setGiornoSlot(g)} style={{
                      flex: 1, padding: "11px 8px", borderRadius: 12, border: "1.5px solid", fontFamily: "var(--font-ui)", fontSize: 13.5,
                      cursor: disp ? "pointer" : "default", opacity: disp ? 1 : 0.4,
                      ...sceltaSt(giornoSlot === g),
                    }}>{g === "oggi" ? "Oggi" : "Domani"}</button>
                  );
                })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, maxHeight: 150, overflowY: "auto" }}>
                {slotData[giornoSlot].map((sl) => (
                  <button key={sl.iso} disabled={sl.pieno} onClick={() => setOrario(sl.iso)} style={{
                    padding: "10px 0", borderRadius: 10, border: "1.5px solid", fontFamily: "var(--font-ui)", fontSize: 13,
                    cursor: sl.pieno ? "default" : "pointer", opacity: sl.pieno ? 0.35 : 1,
                    textDecoration: sl.pieno ? "line-through" : "none",
                    ...sceltaSt(orario === sl.iso),
                  }}>{sl.ora}</button>
                ))}
              </div>
              {giornoSlot === "domani" && !slotData.oggi.length && (
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>Per oggi gli orari sono terminati: il tuo ordine sarà per domani.</div>
              )}
            </div>
          )}

          {tipo === "domicilio" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {(["contanti", "carta"] as const).map((m) => (
                <button key={m} onClick={() => setMetodoPagamento(m)} style={{
                  flex: 1, padding: "13px 8px", borderRadius: 12, border: "1.5px solid", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13.5,
                  ...sceltaSt(metodoPagamento === m),
                }}>{m === "contanti" ? "Contanti alla consegna" : "Carta (POS a domicilio)"}</button>
              ))}
            </div>
          )}

          {scontoMaturato > 0 && (
            <div style={{ marginBottom: 12, padding: "12px 14px", border: "1.5px solid var(--accent-border)", background: "var(--accent-bg-2)", borderRadius: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Hai uno sconto fedeltà di {euro(scontoMaturato)}</div>
              <div style={{ fontSize: 12, color: "var(--text-2)", margin: "2px 0 10px", lineHeight: 1.45 }}>
                È il 10% di quanto hai speso nei tuoi ultimi {TIMBRI_PER_CICLO} ordini (consegna esclusa).
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setUsaSconto(true)} style={{ flex: 1, padding: "11px 6px", borderRadius: 12, border: "1.5px solid", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13, ...sceltaSt(usaSconto === true) }}>Usalo ora</button>
                <button onClick={() => setUsaSconto(false)} style={{ flex: 1, padding: "11px 6px", borderRadius: 12, border: "1.5px solid", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13, ...sceltaSt(usaSconto === false) }}>Tienilo per un altro ordine</button>
              </div>
              {usaSconto === false && (
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8, lineHeight: 1.45 }}>Questo ordine verrà pagato a prezzo pieno e <strong>non darà un timbro</strong>: lo sconto resta sulla tessera.</div>
              )}
              {scontoMaturato > subtotale && subtotale > 0 && (
                <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 8, lineHeight: 1.45 }}>Lo sconto supera la spesa in prodotti: se lo usi ora i prodotti sono gratis (la consegna resta da pagare) e <strong>la parte che avanza va persa</strong>.</div>
              )}
            </div>
          )}

          {consegna > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Consegna</span>
              <span className="num" style={{ fontSize: 12.5, color: "var(--text-2)" }}>{euro(consegna)}</span>
            </div>
          )}
          {scontoApplicato > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, color: "var(--accent-ink)" }}>Sconto fedeltà</span>
              <span className="num" style={{ fontSize: 12.5, color: "var(--accent-ink)" }}>-{euro(scontoApplicato)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Totale</span>
            <span className="num" style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--text)" }}>{euro(totale)}</span>
          </div>
          {erroreInvio && <div style={{ fontSize: 12.5, color: "var(--danger)", marginBottom: 10 }}>{erroreInvio}</div>}
          <button style={btnPrimarySt} onClick={inviaOrdine} disabled={invio}>{invio ? "Invio…" : "Invia ordine"}</button>
        </div>
      )}

      {domandaAperta && DOMANDE[domandaAperta] && (
        <div onClick={() => rispondiDomanda(domandaAperta, false)} style={{
          position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: "24px 20px 20px", width: "100%", maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text)", lineHeight: 1.25 }}>{DOMANDE[domandaAperta].testo}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", margin: "6px 0 18px" }}>{DOMANDE[domandaAperta].sub}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => rispondiDomanda(domandaAperta, false)} style={{
                flex: 1, padding: "14px 8px", borderRadius: 12, border: "1.5px solid var(--border)", background: "#fff", color: "var(--text-2)",
                fontFamily: "var(--font-ui)", fontSize: 14.5, cursor: "pointer",
              }}>No, grazie</button>
              <button onClick={() => rispondiDomanda(domandaAperta, true)} style={{
                flex: 1, padding: "14px 8px", borderRadius: 12, border: "1.5px solid var(--text)", background: "var(--text)", color: "#fff",
                fontFamily: "var(--font-ui)", fontSize: 14.5, fontWeight: 600, cursor: "pointer",
              }}>Sì</button>
            </div>
          </div>
        </div>
      )}

      {cart.length > 0 && !riepilogoVisibile && (
        <div style={{ position: "sticky", bottom: 0, zIndex: 30, margin: "0 -16px", padding: "12px 16px 20px", background: "#F6F6F1", borderTop: "1px solid #E4E5DD" }}>
          <button type="button" onClick={vaiAlRiepilogo} style={{
            width: "100%", height: 60, border: "none", borderRadius: 18, background: "#1B1E17", color: "#FFFFFF", padding: "0 8px 0 18px",
            display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontFamily: "var(--font-ui)",
          }}>
            <span style={{ minWidth: 28, height: 28, borderRadius: 14, background: "#7ECE25", color: "#1B1E17", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{nProdotti}</span>
            <span style={{ flex: 1, textAlign: "left", fontSize: 17, fontWeight: 600 }}>Vai al riepilogo</span>
            <span className="num" style={{ height: 44, padding: "0 14px", borderRadius: 12, background: "#2E3228", display: "flex", alignItems: "center", fontSize: 17, fontWeight: 600 }}>{euro(totale)}</span>
          </button>
        </div>
      )}

      {pizzaModal && (
        <PizzaModalCliente item={pizzaModal} ingredienti={ingredienti} impasti={impasti}
          onChiudi={() => setPizzaModal(null)}
          onConferma={(c) => { setCart((p) => [...p, { ...c, cartId: crypto.randomUUID() }]); setPizzaModal(null); }} />
      )}
    </div>
  );
}


export default function OrdinaFlow(props: { sedeSlugIniziale?: string }) {
  const [modoLogo, setModoLogo] = useState<ModoLogo>("grande");
  const iniziale = modoLogo === "grande";

  useEffect(() => {
    const catturaInstallazione = (e: Event) => { e.preventDefault(); eventoInstalla = e; };
    window.addEventListener("beforeinstallprompt", catturaInstallazione);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw-ordina.js", { scope: "/ordina" }).catch(() => {});
    return () => window.removeEventListener("beforeinstallprompt", catturaInstallazione);
  }, []);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      minHeight: iniziale ? "calc(100dvh - 90px)" : undefined,
      justifyContent: iniziale ? "center" : "flex-start",
    }}>
      <Testata modo={modoLogo} />
      <OrdinaFlowInner {...props} onSchermataIniziale={setModoLogo} />
    </div>
  );
}
