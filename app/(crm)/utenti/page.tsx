"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const S = {
  input: {
    width: "100%", background: "var(--surface-high)", border: "1px solid var(--border)",
    color: "var(--text)", padding: "9px 12px", borderRadius: 8, fontSize: 13,
    outline: "none", fontFamily: "var(--font-sans)",
  } as React.CSSProperties,
  label: {
    display: "block" as const, fontSize: 11, color: "var(--text-dim)",
    marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.5px",
  },
};

export default function UtentiPage() {
  const [utenti, setUtenti] = useState<any[]>([]);
  const [sedi, setSedi] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showPwdModal, setShowPwdModal] = useState<any>(null);
  const [nuovaPwd, setNuovaPwd] = useState("");
  const [form, setForm] = useState({ email: "", nome: "", cognome: "", ruolo: "operatore", sedeId: "", password: "" });
  const [loading, setLoading] = useState(false);

  const carica = () => {
    fetch("/api/utenti").then((r) => r.json()).then((d) => setUtenti(Array.isArray(d) ? d : []));
    fetch("/api/sedi").then((r) => r.json()).then(setSedi);
  };

  useEffect(() => { carica(); }, []);

  const crea = async () => {
    if (!form.email || !form.nome || !form.cognome || !form.password) return toast.error("Compila tutti i campi obbligatori");
    if (form.password.length < 8) return toast.error("Password minimo 8 caratteri");
    setLoading(true);
    const res = await fetch("/api/utenti", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) { toast.success("Utente creato!"); setShowModal(false); setForm({ email: "", nome: "", cognome: "", ruolo: "operatore", sedeId: "", password: "" }); carica(); }
    else { const e = await res.json(); toast.error(e.error ?? "Errore"); }
  };

  const toggleAttivo = async (u: any) => {
    const azione = u.attivo ? "disattivare" : "riattivare";
    if (!confirm(`Vuoi ${azione} ${u.nome} ${u.cognome}?`)) return;
    const res = await fetch(`/api/utenti/${u.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attivo: !u.attivo }),
    });
    if (res.ok) { toast.success(u.attivo ? "Utente disattivato" : "Utente riattivato"); carica(); }
    else { const e = await res.json(); toast.error(e.error ?? "Errore"); }
  };

  const cambiaPwd = async () => {
    if (!nuovaPwd || nuovaPwd.length < 8) return toast.error("Password minimo 8 caratteri");
    const res = await fetch("/api/utenti/cambia-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetEmail: showPwdModal.email, nuovaPassword: nuovaPwd }),
    });
    if (res.ok) { toast.success("Password aggiornata!"); setShowPwdModal(null); setNuovaPwd(""); }
    else { const e = await res.json(); toast.error(e.error ?? "Errore"); }
  };

  const RUOLO_COLOR: Record<string, string> = { super_admin: "#d4a853", sede_manager: "#4a7ec8", operatore: "#8a7a65" };

  return (
    <div className="animate-in">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setShowModal(true)} style={{
          background: "var(--terracotta)", color: "white", border: "none",
          padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)",
        }}>+ Nuovo utente</button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-high)" }}>
              {["Nome", "Email", "Ruolo", "Sede", "Stato", "Azioni"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-dim)", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {utenti.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 500, color: "var(--cream)" }}>
                  {u.nome} {u.cognome}
                </td>
                <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-dim)" }}>{u.email}</td>
                <td style={{ padding: "11px 14px" }}>
                  <span style={{
                    background: `${RUOLO_COLOR[u.ruolo] ?? "#888"}20`, color: RUOLO_COLOR[u.ruolo] ?? "#888",
                    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: "capitalize",
                  }}>{u.ruolo.replace("_", " ")}</span>
                </td>
                <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-dim)" }}>
                  {u.sede?.nome?.replace("Don Basilico ", "") ?? "—"}
                </td>
                <td style={{ padding: "11px 14px" }}>
                  <span style={{
                    fontSize: 11, padding: "3px 8px", borderRadius: 20,
                    background: u.attivo ? "rgba(74,158,107,0.15)" : "rgba(200,64,64,0.15)",
                    color: u.attivo ? "#4a9e6b" : "#c84040",
                  }}>
                    {u.attivo ? "● Attivo" : "● Disattivo"}
                  </span>
                </td>
                <td style={{ padding: "11px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { setShowPwdModal(u); setNuovaPwd(""); }} style={{
                      background: "var(--surface-high)", border: "1px solid var(--border)",
                      color: "var(--text-dim)", padding: "5px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)",
                    }}>🔑 Password</button>
                    <button onClick={() => toggleAttivo(u)} style={{
                      background: u.attivo ? "rgba(200,64,64,0.1)" : "rgba(74,158,107,0.1)",
                      border: `1px solid ${u.attivo ? "rgba(200,64,64,0.3)" : "rgba(74,158,107,0.3)"}`,
                      color: u.attivo ? "#c84040" : "#4a9e6b",
                      padding: "5px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)",
                    }}>{u.attivo ? "🚫 Disattiva" : "✓ Riattiva"}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL CREA UTENTE */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 460, maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700, color: "var(--cream)", marginBottom: 20 }}>Nuovo utente</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {[{ label: "Nome *", key: "nome" }, { label: "Cognome *", key: "cognome" }].map((f) => (
                <div key={f.key}>
                  <label style={S.label}>{f.label}</label>
                  <input style={S.input} value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>

            {[
              { label: "Email *", key: "email", type: "email" },
              { label: "Password * (min 8 caratteri)", key: "password", type: "password" },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={S.label}>{f.label}</label>
                <input style={S.input} type={f.type} value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={S.label}>Ruolo *</label>
                <select style={{ ...S.input }} value={form.ruolo} onChange={(e) => setForm((p) => ({ ...p, ruolo: e.target.value }))}>
                  <option value="operatore">Operatore</option>
                  <option value="sede_manager">Sede Manager</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Sede</label>
                <select style={{ ...S.input }} value={form.sedeId} onChange={(e) => setForm((p) => ({ ...p, sedeId: e.target.value }))}>
                  <option value="">Nessuna (admin)</option>
                  {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome.replace("Don Basilico ", "")}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13 }}>Annulla</button>
              <button onClick={crea} disabled={loading} style={{ background: "var(--terracotta)", color: "white", border: "none", padding: "8px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13 }}>
                {loading ? "Creazione..." : "Crea utente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CAMBIO PASSWORD */}
      {showPwdModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}
          onClick={() => setShowPwdModal(null)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 380, maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700, color: "var(--cream)", marginBottom: 6 }}>Cambia password</h2>
            <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 20 }}>{showPwdModal.email}</p>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Nuova password (min 8 caratteri)</label>
              <input style={S.input} type="password" value={nuovaPwd} onChange={(e) => setNuovaPwd(e.target.value)}
                placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && cambiaPwd()} />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowPwdModal(null)} style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13 }}>Annulla</button>
              <button onClick={cambiaPwd} style={{ background: "var(--terracotta)", color: "white", border: "none", padding: "8px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13 }}>Aggiorna</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
