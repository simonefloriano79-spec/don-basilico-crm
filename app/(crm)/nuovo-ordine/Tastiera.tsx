"use client";
import type { CSSProperties } from "react";

// Tastierino della cassa: sostituisce la tastiera di Windows (che copre mezzo schermo) sui campi del carrello.
// Si appoggia sopra la zona del menu, a sinistra del carrello, così non copre mai i campi che si stanno compilando.
// Scrive nel campo come farebbe una tastiera vera (evento «input»), quindi tutto il resto della cassa — compreso il
// maiuscolo automatico — funziona senza cambiare.

export type CampoTesto = HTMLInputElement | HTMLTextAreaElement;
export type ModoTastiera = "t" | "n"; // t = lettere e numeri, n = solo numeri (telefono, costo)

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
  applica(el, el.value.slice(0, s) + testo + el.value.slice(e), s + testo.length);
}

function cancella(el: CampoTesto) {
  const [s, e] = leggiSelezione(el);
  if (s !== e) return applica(el, el.value.slice(0, s) + el.value.slice(e), s);
  if (s === 0) return;
  applica(el, el.value.slice(0, s - 1) + el.value.slice(s), s - 1);
}

const RIGHE_TESTO = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

const tasto: CSSProperties = {
  height: 54, minWidth: 0, flex: 1, borderRadius: 10, border: "1px solid var(--border)", background: "#fff", color: "var(--text)",
  fontSize: 19, fontWeight: 600, fontFamily: "var(--font-ui)", cursor: "pointer", userSelect: "none", touchAction: "manipulation",
};
const tastoSpeciale: CSSProperties = { ...tasto, background: "var(--surface-muted)", color: "var(--text-3)", fontSize: 15 };

export default function Tastiera({ campo, modo, sinistra, larghezza, onChiudi }: {
  campo: CampoTesto; modo: ModoTastiera; sinistra: number; larghezza: number; onChiudi: () => void;
}) {
  // mousedown bloccato: il campo non perde il fuoco quando si tocca un tasto.
  const premi = (azione: () => void) => ({
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => { campo.focus({ preventScroll: true }); azione(); },
  });
  const Tasto = ({ t, stile = tasto, flex, etichetta }: { t: string; stile?: CSSProperties; flex?: number; etichetta?: string }) => (
    <button type="button" {...premi(() => inserisci(campo, t))} style={{ ...stile, ...(flex ? { flex } : {}) }}>{etichetta ?? t}</button>
  );
  const Indietro = ({ flex }: { flex?: number }) => (
    <button type="button" {...premi(() => cancella(campo))} style={{ ...tastoSpeciale, ...(flex ? { flex } : {}) }} aria-label="Cancella">⌫</button>
  );
  const Chiudi = ({ flex }: { flex?: number }) => (
    <button type="button" {...premi(() => { campo.blur(); onChiudi(); })} style={{ ...tastoSpeciale, background: "var(--text)", color: "#fff", ...(flex ? { flex } : {}) }}>FATTO</button>
  );

  const numerico = modo === "n";
  const larg = numerico ? Math.min(larghezza, 340) : Math.min(larghezza, 820);

  return (
    <div onMouseDown={(e) => e.preventDefault()} style={{
      position: "fixed", bottom: 12, left: sinistra, width: larg, zIndex: 150, padding: 10, borderRadius: 16,
      background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(28,29,24,0.28)",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      {numerico ? (
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ flex: 3, display: "flex", flexDirection: "column", gap: 6 }}>
            {[["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["+", "0", "."]].map((r) => (
              <div key={r.join("")} style={{ display: "flex", gap: 6 }}>{r.map((t) => <Tasto key={t} t={t} />)}</div>
            ))}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <Indietro flex={1} />
            <Chiudi flex={1} />
          </div>
        </div>
      ) : (
        <>
          {RIGHE_TESTO.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 6, padding: i === 2 ? "0 26px" : i === 3 ? "0 0" : 0 }}>
              {r.map((t) => <Tasto key={t} t={t} />)}
              {i === 3 && <Indietro flex={1.6} />}
            </div>
          ))}
          <div style={{ display: "flex", gap: 6 }}>
            {["'", ".", ",", "-", "/", "È", "À"].map((t) => <Tasto key={t} t={t} stile={tastoSpeciale} />)}
            <Tasto t=" " etichetta="SPAZIO" stile={{ ...tasto, fontSize: 13, color: "var(--text-muted)" }} flex={4} />
            <Chiudi flex={2} />
          </div>
        </>
      )}
    </div>
  );
}
