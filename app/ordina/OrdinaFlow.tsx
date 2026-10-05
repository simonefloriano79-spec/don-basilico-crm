"use client";

import { useEffect, useRef, useState } from "react";
import { COSTO_CONSEGNA_DEFAULT } from "@/lib/consegna";

const CAT_LABEL: Record<string, string> = {
  pizze: "Pizze", pizze_rosse: "Pizze rosse", pizze_bianche: "Pizze bianche",
  calzoni: "Calzoni", fritti: "Fritti", bevande: "Bevande", dolci: "Dolci",
  extra: "Extra", menu_speciale: "Speciali",
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
function CartaFedelta({ tessera }: { tessera: Tessera | null }) {
  const timbri = tessera?.timbri ?? 0;
  return (
    <div style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 16, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 600 }}>Tessera fedeltà</span>
        <span className="num" style={{ fontSize: 12.5, color: "var(--text-2)" }}>{timbri} di {TIMBRI_PER_CICLO}</span>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 10 }}>
        {Array.from({ length: TIMBRI_PER_CICLO }).map((_, i) => (
          <span key={i} style={{
            width: 30, height: 30, borderRadius: "50%", border: "1.5px solid", display: "inline-block",
            background: i < timbri ? "var(--accent)" : "transparent", borderColor: i < timbri ? "var(--accent)" : "#8a897f",
          }} />
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-2)", textAlign: "center", lineHeight: 1.45 }}>
        {tessera?.scontoDisponibile
          ? <>Hai maturato uno sconto di <strong>{euro(tessera.importoSconto)}</strong>: lo trovi al riepilogo del prossimo ordine.</>
          : tessera
            ? <>Ancora {TIMBRI_PER_CICLO - timbri} {TIMBRI_PER_CICLO - timbri === 1 ? "ordine" : "ordini"} e ottieni il 10% di sconto sulla spesa.</>
            : <>Ogni ordine è un timbro: ogni {TIMBRI_PER_CICLO} ottieni il 10% di sconto sulla spesa (la consegna non conta). La tessera si attiva con il tuo primo ordine.</>}
      </div>
    </div>
  );
}

// Registrazione dell'evento di installazione (arriva una volta sola, spesso prima che il pulsante sia visibile).
let eventoInstalla: any = null;

function Testata({ grande }: { grande: boolean }) {
  return (
    <img
      src="/brand/don-basilico-logo.png"
      alt="Don Basilico — Naturalmente Pizza"
      style={grande
        ? { display: "block", width: "min(80vw, 340px)", height: "auto", margin: "10px auto 26px" }
        : { display: "block", width: 118, height: "auto", margin: "4px auto 16px" }}
    />
  );
}

// "Scarica sul tuo cellulare": installa l'app (aggiunge l'icona alla schermata Home). Dove il browser lo permette
// (Android/Chrome) parte l'installazione; altrove (iPhone, altri browser) mostra i passaggi.
function BottoneInstalla() {
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
interface CartItem {
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
const ORDINE_CAT = ["menu_speciale", "pizze", "pizze_rosse", "pizze_bianche", "calzoni", "fritti", "dolci", "bevande", "extra"];
const posCat = (c: string) => { const i = ORDINE_CAT.indexOf(c); return i < 0 ? ORDINE_CAT.length : i; };
const num = (v: number | string | undefined) => parseFloat(String(v ?? 0)) || 0;

// Finestra di personalizzazione pizza: toglie ingredienti base, aggiunge extra.
// Stessa regola della cassa: togliere non genera sconto da solo, ma "copre" fino al
// suo valore gli extra aggiunti (mozzarella/pomodoro e simili non danno credito).
function PizzaModalCliente({ item, ingredienti, onConferma, onChiudi }: {
  item: any; ingredienti: IngredienteCl[];
  onConferma: (c: Omit<CartItem, "cartId">) => void; onChiudi: () => void;
}) {
  const base: IngredienteCl[] = (item.ingredienti ?? []).map((ii: any) => ii.ingrediente ?? ii);
  const [rimossi, setRimossi] = useState<Set<string>>(new Set());
  const [aggiunti, setAggiunti] = useState<Map<string, IngredienteCl>>(new Map());
  const [nota, setNota] = useState("");
  const [qty, setQty] = useState(1);
  const [cerca, setCerca] = useState("");

  const prezzoBase = num(item.prezzoEffettivo ?? item.prezzoBase);
  const lordo = Array.from(aggiunti.values()).reduce((a, i) => a + num(i.prezzoAggiunta), 0);
  const credito = base.filter((i) => rimossi.has(i.id) && !i.escludiCompensazione).reduce((a, i) => a + num(i.prezzoAggiunta), 0);
  const unitario = prezzoBase + Math.max(0, lordo - credito);

  const extra = ingredienti.filter((i) => !rimossi.has(i.id) && !i.disabilitatoInSede
    && i.nome.toLowerCase().includes(cerca.toLowerCase()));

  const toggle = <T,>(set: Set<T>, v: T) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); return n; };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.55)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={onChiudi}>
      <div style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", maxHeight: "92vh", display: "flex", flexDirection: "column", width: "100%", maxWidth: 560, margin: "0 auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "18px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 21, color: "var(--text)" }}>{item.nome}</div>
          <span className="num" style={{ fontSize: 14, color: "var(--text-2)" }}>{euro(prezzoBase)}</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 12px" }}>
          {base.length > 0 && (
            <>
              <div style={{ fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-muted)", margin: "6px 0 8px" }}>Ingredienti — tocca per togliere</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {base.map((i) => (
                  <button key={i.id} onClick={() => setRimossi((p) => toggle(p, i.id))} style={{
                    padding: "7px 13px", borderRadius: 20, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-ui)",
                    border: `1px solid ${rimossi.has(i.id) ? "var(--danger-border)" : "var(--border)"}`,
                    background: rimossi.has(i.id) ? "var(--danger-bg)" : "#fff",
                    color: rimossi.has(i.id) ? "var(--danger)" : "var(--text)",
                    textDecoration: rimossi.has(i.id) ? "line-through" : "none",
                  }}>{i.nome}</button>
                ))}
              </div>
            </>
          )}
          <div style={{ fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Aggiungi</div>
          <input style={{ ...fieldSt, marginBottom: 8 }} placeholder="Cerca ingrediente…" value={cerca} onChange={(e) => setCerca(e.target.value)} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, maxHeight: 190, overflowY: "auto" }}>
            {extra.map((i) => {
              const on = aggiunti.has(i.id);
              return (
                <button key={i.id} onClick={() => setAggiunti((p) => { const n = new Map(p); on ? n.delete(i.id) : n.set(i.id, i); return n; })} style={{
                  padding: "7px 13px", borderRadius: 20, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-ui)",
                  border: `1px solid ${on ? "var(--accent-border)" : "var(--border)"}`,
                  background: on ? "var(--accent-bg-2)" : "#fff", color: "var(--text)",
                }}>{on ? "✓ " : "+ "}{i.nome}{num(i.prezzoAggiunta) > 0 ? ` (${euro(num(i.prezzoAggiunta))})` : ""}</button>
              );
            })}
          </div>
          <textarea style={{ ...fieldSt, resize: "none" } as any} rows={2} placeholder="Note per questa pizza (opzionale)" value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>
        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", fontSize: 16 }}>−</button>
            <span className="num" style={{ minWidth: 18, textAlign: "center" }}>{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", fontSize: 16 }}>+</button>
          </div>
          <button style={{ ...btnPrimarySt, flex: 1 }} onClick={() => onConferma({
            menuItemId: item.id, nome: item.nome, categoria: item.categoria, prezzo: unitario, qty,
            rimossi: base.filter((i) => rimossi.has(i.id)).map((i) => ({ id: i.id, nome: i.nome })),
            aggiunti: Array.from(aggiunti.values()).map((i) => ({ id: i.id, nome: i.nome })),
            nota: nota.trim(),
          })}>Aggiungi · {euro(unitario * qty)}</button>
        </div>
      </div>
    </div>
  );
}

function OrdinaFlowInner({ sedeSlugIniziale, onSchermataIniziale }: { sedeSlugIniziale?: string; onSchermataIniziale?: (iniziale: boolean) => void }) {
  const [caricamento, setCaricamento] = useState(true);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [staffBeta, setStaffBeta] = useState(false);

  // Gate OTP
  const [passoGate, setPassoGate] = useState<"telefono" | "codice">("telefono");
  const [telefono, setTelefono] = useState("");
  const [nome, setNome] = useState("");
  const [codice, setCodice] = useState("");
  const [vistaOrdini, setVistaOrdini] = useState(false);
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
  const [pizzaModal, setPizzaModal] = useState<any>(null);
  const [slotData, setSlotData] = useState<SlotData | null>(null);
  const [orario, setOrario] = useState<string>(""); // "asap" oppure ISO dello slot scelto
  const [giornoSlot, setGiornoSlot] = useState<"oggi" | "domani">("oggi");
  // Il riepilogo (carrello + orario + pagamento) scorre insieme al menù, in fondo alla pagina;
  // la barretta in basso serve solo a raggiungerlo e sparisce quando è già visibile.
  const riepilogoRef = useRef<HTMLDivElement | null>(null);
  const [riepilogoVisibile, setRiepilogoVisibile] = useState(false);

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
    } else {
      setStatoIndirizzo("errore");
      setErroreIndirizzo(data.motivo ?? "Indirizzo non coperto");
    }
  };

  const aggiungiAlCarrello = (item: any) => {
    if (CAT_PIZZA.includes(item.categoria)) { setPizzaModal(item); return; }
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
    onSchermataIniziale?.(!tipo && !confermato && !vistaOrdini);
  }, [caricamento, tipo, confermato, vistaOrdini, onSchermataIniziale]);

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
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 420, width: "100%", margin: "0 auto" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text)", textAlign: "center" }}>Ciao {cliente.nome.split(" ")[0]}</h1>
        <CartaFedelta tessera={tessera} />
        <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>Come vuoi ricevere il tuo ordine?</p>
        <button style={{ ...btnPrimarySt }} onClick={() => setTipo("asporto")}>Ritiro in sede</button>
        <button style={{ ...btnPrimarySt, background: "#fff", color: "var(--text)", border: "1px solid var(--border)" }} onClick={() => setTipo("domicilio")}>Consegna a domicilio</button>
        <button style={{ ...btnPrimarySt, background: "transparent", color: "var(--text)", border: "1.5px solid var(--text)" }} onClick={() => setVistaOrdini(true)}>I miei ordini</button>
        <BottoneInstalla />
      </div>
    );
  }

  if (tipo === "asporto" && !sedeSelezionata) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
        <button onClick={() => setTipo(null)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer" }}>← Indietro</button>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text)" }}>Scegli la sede</h2>
        {sedi.map((s) => (
          <button key={s.id} onClick={() => s.ordiniOnlineAttivi !== false && setSedeSelezionata(s.id)} disabled={s.ordiniOnlineAttivi === false} style={{
            textAlign: "left", background: "#fff", border: "1px solid var(--border)", borderRadius: 10,
            padding: "12px 14px", cursor: s.ordiniOnlineAttivi === false ? "default" : "pointer", fontFamily: "var(--font-ui)",
            opacity: s.ordiniOnlineAttivi === false ? 0.55 : 1,
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{s.nome}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.indirizzo}, {s.citta}</div>
            {s.ordiniOnlineAttivi === false && (
              <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>Ordini online sospesi al momento: riprova tra poco o chiamaci</div>
            )}
          </button>
        ))}
      </div>
    );
  }

  if (tipo === "domicilio" && statoIndirizzo !== "ok") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
        <button onClick={() => setTipo(null)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer" }}>← Indietro</button>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text)" }}>Indirizzo di consegna</h2>
        <select style={fieldSt} value={cittaConsegna} onChange={(e) => setCittaConsegna(e.target.value)}>
          <option value="">Città *</option>
          {Array.from(new Set(sedi.map((s: any) => s.citta as string).filter(Boolean))).sort((a, b) => a.localeCompare(b, "it")).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input style={fieldSt} placeholder="Via / piazza *" value={via} onChange={(e) => setVia(e.target.value)} />
        <div style={{ display: "flex", gap: 10 }}>
          <input style={{ ...fieldSt, flex: 1, minWidth: 0 }} placeholder="N. civico *" value={civico} onChange={(e) => setCivico(e.target.value)} />
          <input style={{ ...fieldSt, flex: 1, minWidth: 0 }} placeholder="CAP (facoltativo)" inputMode="numeric" maxLength={5} value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ""))} />
        </div>
        <input style={fieldSt} placeholder="Cognome / nome sul citofono" value={nomeCitofono} onChange={(e) => setNomeCitofono(e.target.value)} />
        {statoIndirizzo === "errore" && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{erroreIndirizzo}</div>}
        <button style={btnPrimarySt} onClick={verificaIndirizzo} disabled={statoIndirizzo === "verificando"}>
          {statoIndirizzo === "verificando" ? "Verifica…" : "Continua"}
        </button>
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
      {tipo === "domicilio" && sedeAssegnata && (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Consegna da <strong style={{ color: "var(--text-2)" }}>{sedeAssegnata.nome}</strong></div>
      )}

      {slotData && !slotData.apertoOra && (
        <div style={{ background: "var(--accent-bg-2)", border: "1px solid var(--accent-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--text)" }}>
          Al momento siamo chiusi (orario {slotData.apertura}–{slotData.chiusura}). Puoi comunque ordinare scegliendo l'orario di
          {" "}{tipo === "domicilio" ? "consegna" : "ritiro"}{slotData.primoGiorno === "domani" ? ": gli orari disponibili sono per domani" : ""}.
        </div>
      )}

      {creaItem && (
        <button onClick={() => setPizzaModal(creaItem)} style={{
          display: "flex", alignItems: "center", gap: 14, textAlign: "left", cursor: "pointer", fontFamily: "var(--font-ui)",
          background: "var(--accent-bg-2)", border: "1.5px solid var(--accent-border)", borderRadius: 14, padding: "14px 16px",
        }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text)" }}>Crea la tua pizza</span>
            <span style={{ display: "block", fontSize: 12.5, color: "var(--text-2)", marginTop: 2 }}>Parti da pomodoro e mozzarella e aggiungi gli ingredienti che vuoi</span>
          </span>
          <span className="num" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>da {euro(parseFloat(creaItem.prezzoEffettivo ?? creaItem.prezzoBase))}</span>
        </button>
      )}

      <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        {catsPresenti.map((c) => (
          <button key={c} onClick={() => setCatFiltro(c)} style={{
            flexShrink: 0, padding: "8px 15px", borderRadius: 20, fontSize: 12.5, cursor: "pointer",
            border: `1px solid ${filtro === c ? "var(--text)" : "var(--border)"}`,
            background: filtro === c ? "var(--text)" : "#fff",
            color: filtro === c ? "#fff" : "var(--text-3)", fontFamily: "var(--font-ui)", whiteSpace: "nowrap",
          }}>{CAT_LABEL[c] ?? c}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {itemsFiltrati.map((item) => {
          const prezzo = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
          return (
            <div key={item.id} onClick={() => aggiungiAlCarrello(item)} style={{
              background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
            }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text)" }}>{item.nome}</div>
                {item.descrizione && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>{item.descrizione}</div>}
              </div>
              <span className="num" style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", flexShrink: 0 }}>{euro(prezzo)}</span>
            </div>
          );
        })}
      </div>

      {cart.length > 0 && (
        <div ref={riepilogoRef} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          {cart.map((c) => (
            <div key={c.cartId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: "var(--text)" }}>{c.nome}</div>
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

      {cart.length > 0 && !riepilogoVisibile && (
        <div style={{ position: "sticky", bottom: 10, zIndex: 20 }}>
          <button
            onClick={() => riepilogoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            style={{ ...btnPrimarySt, display: "flex", justifyContent: "space-between", boxShadow: "0 4px 14px rgba(0,0,0,0.18)" }}
          >
            <span>{cart.reduce((a, c) => a + c.qty, 0)} {cart.reduce((a, c) => a + c.qty, 0) === 1 ? "prodotto" : "prodotti"}</span>
            <span className="num">Vai al riepilogo · {euro(totale)}</span>
          </button>
        </div>
      )}

      {pizzaModal && (
        <PizzaModalCliente item={pizzaModal} ingredienti={ingredienti}
          onChiudi={() => setPizzaModal(null)}
          onConferma={(c) => { setCart((p) => [...p, { ...c, cartId: crypto.randomUUID() }]); setPizzaModal(null); }} />
      )}
    </div>
  );
}


export default function OrdinaFlow(props: { sedeSlugIniziale?: string }) {
  const [iniziale, setIniziale] = useState(true);

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
      <Testata grande={iniziale} />
      <OrdinaFlowInner {...props} onSchermataIniziale={setIniziale} />
    </div>
  );
}
