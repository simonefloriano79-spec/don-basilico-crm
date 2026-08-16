"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import Link from "next/link";

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
  createdAt?: string;
  sedePreferita?: string | null;
  ordini?: any[];
}

const fieldSt: React.CSSProperties = {
  width: "100%", background: "var(--surface-muted)", border: "1px solid var(--border)",
  color: "var(--text)", padding: "9px 12px", borderRadius: 9, fontSize: 12.5,
  outline: "none", fontFamily: "var(--font-ui)",
};
const labelSt: React.CSSProperties = {
  display: "block", fontSize: 10, color: "var(--text-muted)", marginBottom: 6,
  textTransform: "uppercase", letterSpacing: 1.6,
};

const STATO_LABEL: Record<string, string> = {
  nuovo: "nuovo", confermato: "confermato", in_preparazione: "in preparazione",
  pronto: "pronto", consegnato: "consegnato", annullato: "annullato",
};
const STATO_HEX: Record<string, string> = {
  nuovo: "#4a6fa5", confermato: "#b4762a", in_preparazione: "#a05a28",
  pronto: "#4d7c1c", consegnato: "#8a8c80", annullato: "#a8452f",
};

function euro(n: number) {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

function iniziali(c: { nome: string; cognome: string | null }) {
  return `${c.nome[0] ?? ""}${c.cognome?.[0] ?? ""}`.toUpperCase();
}

export default function ClientiPage() {
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
  useEffect(() => { const t = setTimeout(() => cerca(ricerca), 300); return () => clearTimeout(t); }, [ricerca, cerca]);

  const apriDettaglio = async (c: Cliente) => {
    const res = await fetch(`/api/clienti/${c.id}`);
    const data = await res.json();
    setSelected(data);
  };

  const salvaCliente = async () => {
    if (!form.nome) return toast.error("Nome richiesto");
    setLoading(true);
    const res = await fetch("/api/clienti", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
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
      toast.success("Cliente aggiunto");
      setShowModal(false);
      setForm({ nome: "", cognome: "", telefono: "", email: "", indirizzoDefault: "", note: "" });
      cerca(ricerca);
    } else {
      toast.error("Errore nel salvataggio");
    }
  };

  return (
    <div className="animate-in">
      {/* TOOLBAR */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
          <span style={{ position: "absolute", left: 12, top: 10, color: "var(--text-faint)", fontSize: 13 }}>⌕</span>
          <input
            style={{ ...fieldSt, paddingLeft: 34, background: "#fff" }}
            placeholder="Cerca per nome, telefono, email…"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />
        </div>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{clienti.length} clienti</span>
        <button onClick={() => setShowModal(true)} style={{
          marginLeft: "auto", background: "var(--text)", color: "#fff", border: "none",
          padding: "9px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)",
        }}>Nuovo cliente</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 360px" : "1fr", gap: 16, alignItems: "flex-start" }}>
        {/* LISTA */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-muted)" }}>
                {["Cliente", "Telefono", "Ordini", "Speso", "Fidelity", "Ultimo ordine"].map((h) => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clienti.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 44, color: "var(--text-muted)", fontSize: 13 }}>
                  {ricerca ? "Nessun cliente trovato" : "Nessun cliente ancora"}
                </td></tr>
              ) : clienti.map((c) => {
                const fedele = (c.puntiFedelta ?? 0) >= 250;
                return (
                  <tr key={c.id}
                    onClick={() => apriDettaglio(c)}
                    style={{ borderTop: "1px solid var(--border-soft)", cursor: "pointer", background: selected?.id === c.id ? "var(--surface-muted)" : "transparent" }}>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--accent-bg-2)", color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{iniziali(c)}</div>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{c.nome} {c.cognome ?? ""}</div>
                          {c.note && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.note}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="num" style={{ padding: "11px 14px", fontSize: 12.5, color: "var(--text-3)" }}>{c.telefono ?? "—"}</td>
                    <td className="num" style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-2)" }}>{c.numeroOrdini}</td>
                    <td className="num" style={{ padding: "11px 14px", fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{euro(c.totaleSpeso ?? 0)}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <span className="num" style={{
                        display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                        background: fedele ? "var(--accent-bg)" : "var(--surface-muted)",
                        color: fedele ? "var(--accent-ink)" : "var(--text-muted)",
                      }}>{c.puntiFedelta ?? 0} pt</span>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-muted)" }}>
                      {c.ultimoOrdine ? new Date(c.ultimoOrdine).toLocaleDateString("it-IT") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* PANNELLO DETTAGLIO */}
        {selected && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, position: "sticky", top: 0 }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-soft)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Cliente</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--text)" }}>{selected.nome} {selected.cognome ?? ""}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    {selected.createdAt && `Cliente dal ${new Date(selected.createdAt).toLocaleDateString("it-IT", { month: "long", year: "numeric" })}`}
                    {selected.sedePreferita && ` · ${selected.sedePreferita}`}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", fontSize: 13, color: "var(--text-3)", flexShrink: 0 }}>✕</button>
              </div>
              {(selected.puntiFedelta ?? 0) > 0 && (
                <span className="num" style={{
                  display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                  background: (selected.puntiFedelta ?? 0) >= 250 ? "var(--accent-bg)" : "var(--surface-muted)",
                  color: (selected.puntiFedelta ?? 0) >= 250 ? "var(--accent-ink)" : "var(--text-muted)",
                }}>● {(selected.puntiFedelta ?? 0) >= 250 ? "Livello fedeltà alto" : "Livello fedeltà base"}</span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderBottom: "1px solid var(--border-soft)" }}>
              {[
                { label: "Ordini", value: String(selected.numeroOrdini ?? 0) },
                { label: "Speso", value: euro(selected.totaleSpeso ?? 0) },
                { label: "Punti", value: String(selected.puntiFedelta ?? 0) },
              ].map((s, i) => (
                <div key={s.label} style={{ padding: "14px 12px", textAlign: "center", borderLeft: i > 0 ? "1px solid var(--border-soft)" : "none" }}>
                  <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 21, color: "var(--text)" }}>{s.value}</div>
                  <div style={{ fontSize: 9.5, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-soft)", display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Telefono", val: selected.telefono },
                { label: "Email", val: selected.email },
                { label: "Indirizzo", val: selected.indirizzoDefault },
                { label: "Note", val: selected.note },
              ].filter((r) => r.val).map((r) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5 }}>
                  <span style={{ color: "var(--text-muted)" }}>{r.label}</span>
                  <span style={{ color: "var(--text-2)", textAlign: "right" }}>{r.val}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-soft)" }}>
              <div style={{ fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>Storico ordini</div>
              {(selected.ordini ?? []).length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: 16 }}>Nessun ordine</div>
              ) : (selected.ordini ?? []).slice(0, 6).map((o: any) => (
                <div key={o.id} style={{ padding: "10px 0", borderTop: "1px solid var(--border-soft)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span className="num" style={{ fontSize: 12, color: "var(--text-muted)" }}>#{o.numeroOrdine} · {o.sede?.nome?.replace("Don Basilico ", "") ?? ""}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: `${STATO_HEX[o.stato]}14`, color: STATO_HEX[o.stato] }}>{STATO_LABEL[o.stato]}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 4 }}>
                    {(o.items ?? []).slice(0, 3).map((i: any) => `${i.quantita}x ${i.nomeSnapshot}`).join(", ")}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(o.createdAt).toLocaleDateString("it-IT")}</span>
                    <span className="num" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>{euro(parseFloat(o.totale))}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/nuovo-ordine" style={{
                display: "block", textAlign: "center", background: "var(--text)", color: "#fff",
                padding: "10px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, textDecoration: "none", fontFamily: "var(--font-ui)",
              }}>Nuovo ordine</Link>
              <button onClick={() => toast("Invio coupon non ancora configurato")} style={{
                background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)",
                padding: "9px 12px", borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)",
              }}>Invia coupon</button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL NUOVO CLIENTE */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 26, width: 460, maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text)", marginBottom: 18 }}>Nuovo cliente</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {[{ label: "Nome *", key: "nome", placeholder: "Mario" }, { label: "Cognome", key: "cognome", placeholder: "Rossi" }].map((f) => (
                <div key={f.key}>
                  <label style={labelSt}>{f.label}</label>
                  <input style={fieldSt} placeholder={f.placeholder} value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
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
                <label style={labelSt}>{f.label}</label>
                <input style={fieldSt} placeholder={f.placeholder} value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={() => setShowModal(false)} style={{
                background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)",
                padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5,
              }}>Annulla</button>
              <button onClick={salvaCliente} disabled={loading} style={{
                background: "var(--text)", color: "#fff", border: "none",
                padding: "9px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)",
              }}>{loading ? "Salvataggio…" : "Aggiungi cliente"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
