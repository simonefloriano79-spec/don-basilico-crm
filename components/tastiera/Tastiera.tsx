"use client";
import { useState, type CSSProperties } from "react";

// Il disegno del tastierino (quando si apre e dove lo decide TastierinoCrm).
// Scrive nel campo come farebbe una tastiera vera (evento «input»), quindi tutto il resto — compreso il maiuscolo
// automatico della cassa — funziona senza cambiare.

export type CampoTesto = HTMLInputElement | HTMLTextAreaElement;
export type ModoTastiera = "t" | "n" | "o"; // t = lettere e numeri, n = numeri (telefono, prezzi), o = orario (con «:»)

function applica(el: CampoTesto, valore: string, pos: number | null) {
  // Il setter nativo (e non el.value = ...) serve perché React si accorga della modifica del campo controllato.
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, valore);
  if (pos !== null) { try { el.setSelectionRange(pos, pos); } catch { /* campo senza selezione */ } }
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function leggiSelezione(el: CampoTesto): [number, number] {
  const fine = el.value.length;
  try {
    const s = el.selectionStart, e = el.selectionEnd;
    return s === null || e === null ? [fine, fine] : [s, e];
  } catch { return [fine, fine]; }
}

function inserisci(el: CampoTesto, testo: string) {
  const [s, e] = leggiSelezione(el);
  if (el.maxLength > 0 && el.value.length - (e - s) + testo.length > el.maxLength) return;
  applica(el, el.value.slice(0, s) + testo + el.value.slice(e), s + testo.length);
}

function cancella(el: CampoTesto) {
  const [s, e] = leggiSelezione(el);
  if (s !== e) return applica(el, el.value.slice(0, s) + el.value.slice(e), s);
  if (s === 0) return;
  applica(el, el.value.slice(0, s - 1) + el.value.slice(s), s - 1);
}

const NUMERI = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const LETTERE = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];
const SIMBOLI = [
  ["!", "?", "\"", "#", "€", "$", "%", "&", "(", ")"],
  ["=", "+", "*", "_", ":", ";", "@", "/", "\\"],
  ["<", ">", "[", "]", "{", "}", "|", "^", "~"],
];

const tasto: CSSProperties = {
  height: 52, minWidth: 0, flex: 1, borderRadius: 10, border: "1px solid var(--border)", background: "#fff", color: "var(--text)",
  fontSize: 19, fontWeight: 600, fontFamily: "var(--font-ui)", cursor: "pointer", userSelect: "none", touchAction: "manipulation",
};
const tastoSpeciale: CSSProperties = { ...tasto, background: "var(--surface-muted)", color: "var(--text-3)", fontSize: 15 };
const riga: CSSProperties = { display: "flex", gap: 6 };

export default function Tastiera({ campo, modo, sinistra, larghezza, soloMaiuscole, onChiudi }: {
  campo: CampoTesto; modo: ModoTastiera; sinistra: number; larghezza: number; soloMaiuscole: boolean; onChiudi: () => void;
}) {
  const tipo = campo.getAttribute("type") ?? "";
  // Un campo di testo vuoto parte con la maiuscola (nomi, vie); email, password e ricerche no.
  const [maiuscole, setMaiuscole] = useState(() => modo === "t" && !campo.value && !["email", "password", "search"].includes(tipo));
  const [simboli, setSimboli] = useState(false);
  const alto = soloMaiuscole || maiuscole;
  const lettera = (t: string) => (alto ? t.toUpperCase() : t);

  // mousedown bloccato: il campo non perde il fuoco quando si tocca un tasto.
  const premi = (azione: () => void) => ({
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => { campo.focus({ preventScroll: true }); azione(); },
  });
  const tastoTesto = (t: string, stile: CSSProperties = tasto, etichetta?: string) => (
    <button key={etichetta ?? t} type="button" style={stile}
      {...premi(() => { inserisci(campo, t); if (maiuscole && t.trim()) setMaiuscole(false); })}>{etichetta ?? t}</button>
  );
  const indietro = (stile: CSSProperties) => (
    <button key="indietro" type="button" {...premi(() => cancella(campo))} style={stile} aria-label="Cancella">⌫</button>
  );
  const fatto = (stile: CSSProperties) => (
    <button key="fatto" type="button" {...premi(() => { campo.blur(); onChiudi(); })} style={{ ...tastoSpeciale, background: "var(--text)", color: "#fff", ...stile }}>FATTO</button>
  );

  return (
    <div data-tastierino onMouseDown={(e) => e.preventDefault()} style={{
      position: "fixed", bottom: 12, left: sinistra, width: larghezza, zIndex: 3000, padding: 10, borderRadius: 16,
      background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(28,29,24,0.28)",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      {modo !== "t" ? (
        <div style={riga}>
          <div style={{ flex: 3, display: "flex", flexDirection: "column", gap: 6 }}>
            {[["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], [modo === "o" ? ":" : "+", "0", "."]].map((r) => (
              <div key={r.join("")} style={riga}>{r.map((t) => tastoTesto(t))}</div>
            ))}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            {indietro({ ...tastoSpeciale, flex: 1 })}
            {fatto({ flex: 1 })}
          </div>
        </div>
      ) : (
        <>
          <div style={riga}>{NUMERI.map((t) => tastoTesto(t))}</div>
          {simboli ? (
            <>
              <div style={riga}>{SIMBOLI[0].map((t) => tastoTesto(t))}</div>
              <div style={riga}>{SIMBOLI[1].map((t) => tastoTesto(t))}</div>
              <div style={riga}>{SIMBOLI[2].map((t) => tastoTesto(t))}{indietro({ ...tastoSpeciale, flex: 1.6 })}</div>
            </>
          ) : (
            <>
              <div style={riga}>{LETTERE[0].map((t) => tastoTesto(lettera(t)))}</div>
              <div style={{ ...riga, padding: "0 26px" }}>{LETTERE[1].map((t) => tastoTesto(lettera(t)))}</div>
              <div style={riga}>
                {!soloMaiuscole && (
                  <button type="button" aria-label="Maiuscole" aria-pressed={maiuscole} {...premi(() => setMaiuscole((m) => !m))}
                    style={{ ...tastoSpeciale, flex: 1.6, ...(maiuscole ? { background: "var(--text)", color: "#fff" } : {}) }}>⇧</button>
                )}
                {LETTERE[2].map((t) => tastoTesto(lettera(t)))}
                {indietro({ ...tastoSpeciale, flex: 1.6 })}
              </div>
            </>
          )}
          <div style={riga}>
            <button type="button" {...premi(() => setSimboli((s) => !s))} style={{ ...tastoSpeciale, flex: 1.6 }}>{simboli ? "ABC" : "#+="}</button>
            {["'", ".", ",", "-", "/", "@"].map((t) => tastoTesto(t, tastoSpeciale))}
            {tastoTesto(" ", { ...tasto, fontSize: 13, color: "var(--text-muted)", flex: 3.5 }, "SPAZIO")}
            {["è", "à", "ò", "ù"].map((t) => tastoTesto(lettera(t), tastoSpeciale))}
            {campo instanceof HTMLTextAreaElement && tastoTesto("\n", { ...tastoSpeciale, flex: 1.3 }, "↵")}
            {fatto({ flex: 2 })}
          </div>
        </>
      )}
    </div>
  );
}
