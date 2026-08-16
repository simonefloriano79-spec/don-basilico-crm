"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const fieldSt: React.CSSProperties = {
  width: "100%", background: "var(--surface-muted)", border: "1px solid var(--border)",
  color: "var(--text)", padding: "9px 12px", borderRadius: 9, fontSize: 12.5, outline: "none", fontFamily: "var(--font-ui)",
};
const labelSt: React.CSSProperties = {
  display: "block", fontSize: 10, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1.6,
};
const RUOLO_LABEL: Record<string, string> = { super_admin: "super admin", sede_manager: "sede manager", operatore: "operatore" };

function iniziali(u: { nome: string; cognome: string }) {
  return `${u.nome[0] ?? ""}${u.cognome?.[0] ?? ""}`.toUpperCase();
}

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
    const res = await fetch("/api/utenti", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setLoading(false);
    if (res.ok) { toast.success("Utente creato"); setShowModal(false); setForm({ email: "", nome: "", cognome: "", ruolo: "operatore", sedeId: "", password: "" }); carica(); }
    else { const e = await res.json(); toast.error(e.error ?? "Errore"); }
  };

  const toggleAttivo = async (u: any) => {
    const azione = u.attivo ? "disattivare" : "riattivare";
    if (!confirm(`Vuoi ${azione} ${u.nome} ${u.cognome}?`)) return;
    const res = await fetch(`/api/utenti/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attivo: !u.attivo }) });
    if (res.ok) { toast.success(u.attivo ? "Utente disattivato" : "Utente riattivato"); carica(); }
    else { const e = await res.json(); toast.error(e.error ?? "Errore"); }
  };

  const cambiaPwd = async () => {
    if (!nuovaPwd || nuovaPwd.length < 8) return toast.error("Password minimo 8 caratteri");
    const res = await fetch("/api/utenti/cambia-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetEmail: showPwdModal.email, nuovaPassword: nuovaPwd }) });
    if (res.ok) { toast.success("Password aggiornata"); setShowPwdModal(null); setNuovaPwd(""); }
    else { const e = await res.json(); toast.error(e.error ?? "Errore"); }
  };

  const attivi = utenti.filter((u) => u.attivo).length;

  return (
    <div className="animate-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{utenti.length} utenti · {attivi} attivi</span>
        <button onClick={() => setShowModal(true)} style={{
          background: "var(--text)", color: "#fff", border: "none",
          padding: "9px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)",
        }}>Nuovo utente</button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)" }}>
              {["Nome", "Ruolo", "Sede", "Stato", "Azioni"].map((h) => (
                <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {utenti.map((u) => {
              const isAdmin = u.ruolo === "super_admin";
              return (
                <tr key={u.id} style={{ borderTop: "1px solid var(--border-soft)", opacity: u.attivo ? 1 : 0.55 }}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                        background: isAdmin ? "var(--text)" : "var(--accent-bg-2)",
                        color: isAdmin ? "#fff" : "var(--accent-ink)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                      }}>{iniziali(u)}</div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{u.nome} {u.cognome}</div>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                      background: isAdmin ? "var(--text)" : "var(--surface-muted)",
                      color: isAdmin ? "#fff" : "var(--text-3)",
                    }}>{RUOLO_LABEL[u.ruolo] ?? u.ruolo}</span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--text-3)" }}>{u.sede?.nome?.replace("Don Basilico ", "") ?? "—"}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20,
                      background: u.attivo ? "var(--accent-bg)" : "var(--danger-bg)",
                      color: u.attivo ? "var(--accent-ink)" : "var(--danger)",
                    }}>{u.attivo ? "Attivo" : "Disattivo"}</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setShowPwdModal(u); setNuovaPwd(""); }} style={{
                        background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)",
                        padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)",
                      }}>Password</button>
                      <button onClick={() => toggleAttivo(u)} style={{
                        background: u.attivo ? "var(--danger-bg)" : "var(--accent-bg-2)",
                        border: `1px solid ${u.attivo ? "var(--danger-border)" : "var(--accent-border)"}`,
                        color: u.attivo ? "var(--danger)" : "var(--accent-ink)",
                        padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)",
                      }}>{u.attivo ? "Disattiva" : "Riattiva"}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 26, width: 460, maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text)", marginBottom: 18 }}>Nuovo utente</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {[{ label: "Nome *", key: "nome" }, { label: "Cognome *", key: "cognome" }].map((f) => (
                <div key={f.key}>
                  <label style={labelSt}>{f.label}</label>
                  <input style={fieldSt} value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>

            {[
              { label: "Email *", key: "email", type: "email" },
              { label: "Password * (min 8 caratteri)", key: "password", type: "password" },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={labelSt}>{f.label}</label>
                <input style={fieldSt} type={f.type} value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              <div>
                <label style={labelSt}>Ruolo *</label>
                <select style={fieldSt} value={form.ruolo} onChange={(e) => setForm((p) => ({ ...p, ruolo: e.target.value }))}>
                  <option value="operatore">Operatore</option>
                  <option value="sede_manager">Sede manager</option>
                  <option value="super_admin">Super admin</option>
                </select>
              </div>
              <div>
                <label style={labelSt}>Sede</label>
                <select style={fieldSt} value={form.sedeId} onChange={(e) => setForm((p) => ({ ...p, sedeId: e.target.value }))}>
                  <option value="">Nessuna (admin)</option>
                  {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome.replace("Don Basilico ", "")}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)", padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5 }}>Annulla</button>
              <button onClick={crea} disabled={loading} style={{ background: "var(--text)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 9, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5 }}>
                {loading ? "Creazione…" : "Crea utente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPwdModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowPwdModal(null)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 26, width: 380, maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text)", marginBottom: 6 }}>Cambia password</h2>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 18 }}>{showPwdModal.email}</p>

            <div style={{ marginBottom: 16 }}>
              <label style={labelSt}>Nuova password (min 8 caratteri)</label>
              <input style={fieldSt} type="password" value={nuovaPwd} onChange={(e) => setNuovaPwd(e.target.value)}
                placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && cambiaPwd()} />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowPwdModal(null)} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)", padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5 }}>Annulla</button>
              <button onClick={cambiaPwd} style={{ background: "var(--text)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 9, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5 }}>Aggiorna</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
