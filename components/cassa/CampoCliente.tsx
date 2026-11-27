"use client";

// Campo della cassa che, mentre si scrive, mostra sotto i clienti che corrispondono: un tocco compila tutto l'ordine.
// L'elenco sta SOPRA il resto (non sposta i campi) e niente cambia senza un tocco su un cliente.
import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

export interface ClienteSuggerito {
  id: string; nome: string; cognome?: string | null;
  telefono?: string | null; indirizzoDefault?: string | null; note?: string | null;
}

type Props = InputHTMLAttributes<HTMLInputElement> & {
  cerca: "nome" | "telefono" | "indirizzo" | null; // null = campo normale, senza elenco
  onScegli: (c: ClienteSuggerito) => void;
};

export default function CampoCliente({ cerca, onScegli, onChange, ...campo }: Props) {
  const [aperto, setAperto] = useState(false); // solo dopo che si è scritto qualcosa a mano
  const [trovati, setTrovati] = useState<ClienteSuggerito[]>([]);
  const lista = useRef<HTMLDivElement>(null);
  const chiusura = useRef<ReturnType<typeof setTimeout>>();
  const testo = String(campo.value ?? "").trim();

  useEffect(() => {
    if (!aperto || !cerca || testo.length < (cerca === "telefono" ? 3 : 2)) { setTrovati([]); return; }
    const stop = new AbortController(); // la risposta di una lettera precedente non deve sovrascrivere l'ultima
    const attesa = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clienti?suggerimenti=${cerca}&q=${encodeURIComponent(testo)}`, { signal: stop.signal });
        setTrovati(res.ok ? await res.json() : []);
      } catch { /* richiesta annullata o rete assente: si continua a scrivere a mano */ }
    }, 200);
    return () => { clearTimeout(attesa); stop.abort(); };
  }, [aperto, cerca, testo]);

  const visibile = aperto && trovati.length > 0;
  useEffect(() => { if (visibile) lista.current?.scrollIntoView({ block: "nearest" }); }, [visibile]);
  useEffect(() => () => clearTimeout(chiusura.current), []);

  const chiudi = () => { setAperto(false); setTrovati([]); };

  return (
    <div style={{ position: "relative" }}>
      <input {...campo} autoComplete="off"
        onChange={(e) => { if (cerca) setAperto(true); onChange?.(e); }}
        onFocus={() => clearTimeout(chiusura.current)}
        // Un attimo di attesa: il tocco fuori dall'elenco deve arrivare a destinazione prima che l'elenco sparisca.
        onBlur={() => { chiusura.current = setTimeout(chiudi, 200); }}
        onKeyDown={(e) => { if (e.key === "Escape") chiudi(); }} />
      {visibile && (
        // preventDefault: toccando l'elenco il campo resta attivo e l'elenco non si chiude sotto il dito.
        <div ref={lista} data-clienti-suggeriti onMouseDown={(e) => e.preventDefault()} style={{
          position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 20, maxHeight: 290, overflowY: "auto",
          background: "#fff", border: "1px solid var(--accent-border)", borderRadius: 10, boxShadow: "0 10px 28px rgba(28,29,24,0.22)",
        }}>
          <button type="button" tabIndex={-1} onClick={chiudi} style={{
            position: "sticky", top: 0, width: "100%", display: "flex", justifyContent: "space-between", padding: "8px 12px",
            background: "var(--accent-bg-2)", border: "none", borderBottom: "1px solid var(--border-soft)", cursor: "pointer",
            fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--accent-ink)",
          }}><span>Clienti trovati</span><span>Chiudi ✕</span></button>
          {trovati.map((c) => (
            <button key={c.id} type="button" tabIndex={-1} style={{
              display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "#fff", border: "none",
              borderBottom: "1px solid var(--border-soft)", cursor: "pointer", fontFamily: "var(--font-ui)",
            }} onClick={(e) => {
              onScegli(c);
              chiudi();
              // Scelto il cliente il campo si lascia: così si chiude anche il tastierino.
              (e.currentTarget.closest("[data-clienti-suggeriti]")?.previousElementSibling as HTMLElement | null)?.blur();
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{[c.nome, c.cognome].filter(Boolean).join(" ")}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {[c.telefono, c.indirizzoDefault].filter(Boolean).join(" — ") || "—"}
              </div>
              {c.note && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{c.note}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
