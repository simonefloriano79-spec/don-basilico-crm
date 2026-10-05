"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface Riga { id: string; nome: string; supplemento: number; inSede: boolean; }

// Impasti speciali che la pizzeria prepara: spunta quelli attivi. Il "classico" è sempre disponibile e non è in elenco.
export function ImpastiSede({ sedeId }: { sedeId: string }) {
  const [righe, setRighe] = useState<Riga[] | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch(`/api/sedi/${sedeId}/impasti`).then((r) => r.json()).then((d) => setRighe(d.impasti ?? [])).catch(() => setRighe([]));
  }, [sedeId]);

  if (righe === null || righe.length === 0) return null;

  const cambia = async (id: string, valore: boolean) => {
    const nuove = righe.map((r) => (r.id === id ? { ...r, inSede: valore } : r));
    setRighe(nuove);
    setSalvando(true);
    const res = await fetch(`/api/sedi/${sedeId}/impasti`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ impastoIds: nuove.filter((r) => r.inSede).map((r) => r.id) }),
    });
    setSalvando(false);
    if (!res.ok) { toast.error("Non sono riuscito a salvare"); setRighe(righe); }
  };

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-soft)" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>
        Impasti speciali {salvando && <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>· salvo…</span>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {righe.map((r) => (
          <button key={r.id} onClick={() => cambia(r.id, !r.inSede)} style={{
            padding: "5px 11px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)", border: "1.5px solid",
            background: r.inSede ? "var(--text)" : "#fff", color: r.inSede ? "#fff" : "var(--text-3)",
            borderColor: r.inSede ? "var(--text)" : "var(--border)",
          }}>{r.inSede ? "✓ " : ""}{r.nome}</button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
        Il classico è sempre incluso. Gli speciali costano +€ 1,00 a pizza (rosse, bianche e speciali).
      </div>
    </div>
  );
}
