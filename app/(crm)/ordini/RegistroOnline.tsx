"use client";

import { useEffect, useState } from "react";

interface Riga { id: string; sedeNome: string; attivi: boolean; utenteNome: string | null; createdAt: string }

// Elenco di chi ha acceso o spento gli ordini online (ultime modifiche). `versione` cambia a ogni tocco dell'interruttore e fa ricaricare l'elenco.
export function RegistroOnline({ versione, superAdmin }: { versione: number; superAdmin: boolean }) {
  const [righe, setRighe] = useState<Riga[]>([]);
  const [attivo, setAttivo] = useState(true);

  useEffect(() => {
    let vivo = true;
    fetch("/api/sedi/registro-online", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d) { setRighe(Array.isArray(d.righe) ? d.righe : []); setAttivo(d.ok !== false); } })
      .catch(() => {});
    return () => { vivo = false; };
  }, [versione]);

  // Se la tabella non c'è ancora lo vede solo chi può fare qualcosa (super admin).
  if (!attivo) {
    return superAdmin ? (
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 16 }}>
        Registro «chi ha acceso/spento» non ancora attivo: manca la tabella nel database.
      </div>
    ) : null;
  }

  return (
    <details style={{ marginBottom: 16 }}>
      <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--text-3)", padding: "4px 2px" }}>
        Chi ha acceso o spento gli ordini online
      </summary>
      <div style={{ marginTop: 6, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "4px 14px" }}>
        {righe.length === 0 ? (
          <div style={{ padding: "12px 0", fontSize: 12.5, color: "var(--text-muted)" }}>
            Ancora nessuna modifica registrata (il registro parte da oggi).
          </div>
        ) : (
          righe.map((r, i) => (
            <div key={r.id} style={{ padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid var(--border-soft)", fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.45 }}>
              <span style={{ color: "var(--text-muted)" }}>
                {new Date(r.createdAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
              {" · "}
              <strong style={{ color: "var(--text)" }}>{r.sedeNome.replace("Don Basilico ", "")}</strong>
              {" "}
              <span style={{ color: r.attivi ? "var(--accent-ink)" : "var(--danger)" }}>{r.attivi ? "riattivati" : "sospesi"}</span>
              {" da "}
              {r.utenteNome ?? "utente sconosciuto"}
            </div>
          ))
        )}
      </div>
    </details>
  );
}
