"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

interface Cliente {
  id: string;
  nome: string;
  cognome: string | null;
  telefono: string | null;
  email: string | null;
  indirizzoDefault: string | null;
  note: string | null;
  puntiFedelta: number;
  totaleSpeso: number;
  numeroOrdini: number;
  ultimoOrdine: string | null;
  ordini?: any[];
}

const S = {
  card: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 12, padding: 20,
  } as React.CSSProperties,
  input: {
    background: "var(--surface-high)", border: "1px solid var(--border)",
    color: "var(--text)", padding: "9px 12px", borderRadius: 8,
    fontSize: 13, outline: "none", width: "100%",
    fontFamily: "var(--font-sans)",
  } as React.CSSProperties,
  label: {
    display: "block" as const, fontSize: 11, color: "var(--text-dim)",
    marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.5px",
  },
  btnPrimary: {
    background: "var(--terracotta)", color: "white", border: "none",
    padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
    cursor: "pointer", fontFamily: "var(--font-sans)",
  } as React.CSSProperties,
};

export default function ClientiPage() {
  const { data: session } = useSession();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [ricerca, setRicerca] = useState("");
  const [selected, setSelected] = useState<Cliente | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: "", cognome: "", telefono: "", email: "", indirizzoDefault: "", note: "",
  });

  const cerca = useCallback(async (q: string) => {
    const url = q ? `/api/clienti?q=${encodeURIComponent(q)}&limit=30` : "/api/clienti?limit=30";
    const res = await fetch(url);
    const data = await res.json();
    setClienti(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { cerca(""); }, []);

  useEffect(() => {
    const t = setTimeout(() => cerca(ricerca), 300);
    return () => clearTimeout(t);
  }, [ricerca, cerca]);

  const apriDettaglio = async (c: Cliente) => {
    const res = await fetch(`/api/clienti/${c.id}`);
    const data = await res.json();
    setSelected(data);
  };

  const salvaCliente = async () => {
    if (!form.nome) return toast.error("Nome richiesto");
    setLoading(true);
    const res = await fetch("/api/clienti", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.status === 409) {
      const data = await res.json();
      toast.error("Cliente già presente con questo telefono");
      setSelected(data.cliente);
      setShowModal(false);
      return;
    }
    if (res.ok) {
      toast.success("Cliente aggiunto!");
      setShowModal(false);
      setForm({ nome: "", cognome: "", telefono: "", email: "", indirizzoDefault: "", note: "" });
      cerca(ricerca);
    } else {
      toast.error("Errore nel salvataggio");
    }
  };

  const STATO_COLOR: Record<string, string> = {
    nuovo: "#4a7ec8", confermato: "#d4a853", in_preparazione: "#c85a2e",
    pronto: "#4a9e6b", consegnato: "#8a7a65", annullato: "#c84040",
  };

  return (
    <div className="animate-in">
      {/* TOOLBAR */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", fontSize: 14 }}>🔍</span>
          <input
            style={{ ...S.input, paddingLeft: 36 }}
            placeholder="Cerca per nome, telefono, email..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />
        </div>
        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{clienti.length} clienti</span>
        <button style={S.btnPrimary} onClick={() => setShowModal(true)}>+ Nuovo cliente</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 16 }}>
        {/* LISTA */}
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-high)" }}>
                {["Cliente", "Telefono", "Email", "Ordini", "Speso", "Ultimo ordine"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-dim)", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clienti.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-dim)", fontSize: 13 }}>
                  {ricerca ? "Nessun cliente trovato" : "Nessun cliente ancora"}
                </td></tr>
              ) : clienti.map((c) => (
                <tr key={c.id}
                  onClick={() => apriDettaglio(c)}
                  style={{
                    borderTop: "1px solid var(--border)", cursor: "pointer",
                    background: selected?.id === c.id ? "rgba(200,90,46,0.05)" : "transparent",
                  }}>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--cream)" }}>
                      {c.nome} {c.cognome ?? ""}
                    </div>
                    {c.note && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>📝 {c.note}</div>}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-dim)" }}>
                    {c.telefono ?? "—"}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-dim)" }}>
                    {c.email ?? "—"}
                  </td>
                  <td style={{ padding: "11px 14px", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                    {c.numeroOrdini}
                  </td>
                  <td style={{ padding: "11px 14px", fontFamily: "var(--font-mono)", fontSize: 13, color: "#d4a853" }}>
                    €{(c.totaleSpeso ?? 0).toFixed(2)}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-dim)" }}>
                    {c.ultimoOrdine
                      ? new Date(c.ultimoOrdine).toLocaleDateString("it-IT")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* DETTAGLIO */}
        {selected && (
          <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 700, color: "var(--cream)" }}>
                {selected.nome} {selected.cognome ?? ""}
              </h2>
              <button onClick={() => setSelected(null)} style={{
                background: "transparent", border: "1px solid var(--border)",
                color: "var(--text-dim)", width: 28, height: 28, borderRadius: 6, cursor: "pointer",
              }}>✕</button>
            </div>

            {/* Info */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { icon: "📞", val: selected.telefono },
                { icon: "📧", val: selected.email },
                { icon: "📍", val: selected.indirizzoDefault },
                { icon: "📝", val: selected.note },
              ].filter((r) => r.val).map((r, i) => (
                <div key={i} style={{ fontSize: 13, color: "var(--text-dim)", display: "flex", gap: 8 }}>
                  <span>{r.icon}</span><span>{r.val}</span>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "Ordini totali", value: selected.numeroOrdini ?? 0 },
                { label: "Speso totale", value: `€${(selected.totaleSpeso ?? 0).toFixed(2)}` },
              ].map((s) => (
                <div key={s.label} style={{
                  background: "var(--surface-high)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "10px 12px",
                }}>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 600, color: "var(--cream)", marginTop: 4 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Storico ordini */}
            <div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Ultimi ordini</div>
              {(selected.ordini ?? []).length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-dim)", textAlign: "center", padding: 16 }}>Nessun ordine</div>
              ) : (selected.ordini ?? []).map((o: any) => (
                <div key={o.id} style={{
                  padding: "10px 12px", background: "var(--surface-high)", borderRadius: 8,
                  marginBottom: 6, border: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
                      #{o.numeroOrdine} · {o.sede?.nome?.replace("Don Basilico ", "") ?? ""}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                      background: `${STATO_COLOR[o.stato] ?? "#888"}20`,
                      color: STATO_COLOR[o.stato] ?? "#888",
                    }}>
                      {o.stato.replace("_", " ")}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>
                    {(o.items ?? []).slice(0, 3).map((i: any) => `${i.quantita}x ${i.nomeSnapshot}`).join(", ")}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      {new Date(o.createdAt).toLocaleDateString("it-IT")}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#d4a853" }}>
                      €{parseFloat(o.totale).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL NUOVO CLIENTE */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 460, maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700, color: "var(--cream)", marginBottom: 20 }}>Nuovo cliente</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {[
                { label: "Nome *", key: "nome", placeholder: "Mario" },
                { label: "Cognome", key: "cognome", placeholder: "Rossi" },
              ].map((f) => (
                <div key={f.key}>
                  <label style={S.label}>{f.label}</label>
                  <input style={S.input} placeholder={f.placeholder}
                    value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>

            {[
              { label: "Telefono", key: "telefono", placeholder: "085-0000000" },
              { label: "Email", key: "email", placeholder: "mario@email.it" },
              { label: "Indirizzo default", key: "indirizzoDefault", placeholder: "Via Roma 1, Pescara" },
              { label: "Note (allergie, preferenze)", key: "note", placeholder: "Es. senza glutine" },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={S.label}>{f.label}</label>
                <input style={S.input} placeholder={f.placeholder}
                  value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={() => setShowModal(false)} style={{
                background: "var(--surface-high)", border: "1px solid var(--border)",
                color: "var(--text)", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13,
              }}>Annulla</button>
              <button onClick={salvaCliente} disabled={loading} style={S.btnPrimary}>
                {loading ? "Salvataggio..." : "Aggiungi cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
