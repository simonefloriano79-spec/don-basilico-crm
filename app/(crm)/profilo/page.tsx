"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

export default function ProfiloPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [form, setForm] = useState({ passwordAttuale: "", nuovaPassword: "", conferma: "" });
  const [loading, setLoading] = useState(false);

  const cambiaPassword = async () => {
    if (!form.passwordAttuale || !form.nuovaPassword) return toast.error("Compila tutti i campi");
    if (form.nuovaPassword.length < 8) return toast.error("Minimo 8 caratteri");
    if (form.nuovaPassword !== form.conferma) return toast.error("Le password non coincidono");

    setLoading(true);
    const res = await fetch("/api/utenti/cambia-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        passwordAttuale: form.passwordAttuale,
        nuovaPassword: form.nuovaPassword,
      }),
    });
    setLoading(false);

    if (res.ok) {
      toast.success("Password cambiata con successo!");
      setForm({ passwordAttuale: "", nuovaPassword: "", conferma: "" });
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Errore nel cambio password");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--surface-muted)", border: "1px solid var(--border)",
    color: "var(--text)", padding: "10px 12px", borderRadius: 8, fontSize: 13,
    outline: "none", fontFamily: "var(--font-ui)",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, color: "var(--text-muted)",
    marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px",
  };

  return (
    <div className="animate-in" style={{ maxWidth: 480 }}>

      {/* INFO UTENTE */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
          Il mio profilo
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "Nome", value: user?.name },
            { label: "Email", value: user?.email },
            { label: "Ruolo", value: user?.ruolo === "super_admin" ? "Super Admin" : "Operatore" },
            ...(user?.sedeNome ? [{ label: "Sede", value: user.sedeNome }] : []),
          ].map(f => (
            <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{f.label}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CAMBIO PASSWORD */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
          Cambia password
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
          Ti consigliamo di cambiare la password predefinita al primo accesso.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Password attuale</label>
            <input style={inputStyle} type="password" placeholder="••••••••"
              value={form.passwordAttuale} onChange={e => setForm(p => ({ ...p, passwordAttuale: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Nuova password</label>
            <input style={inputStyle} type="password" placeholder="Minimo 8 caratteri"
              value={form.nuovaPassword} onChange={e => setForm(p => ({ ...p, nuovaPassword: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Conferma nuova password</label>
            <input style={inputStyle} type="password" placeholder="Ripeti la nuova password"
              value={form.conferma} onChange={e => setForm(p => ({ ...p, conferma: e.target.value }))} />
          </div>

          <button
            onClick={cambiaPassword}
            disabled={loading}
            style={{
              background: "var(--text)", color: "white", border: "none",
              padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", fontFamily: "var(--font-ui)",
              opacity: loading ? 0.7 : 1, marginTop: 4,
            }}
          >
            {loading ? "Salvataggio..." : "Aggiorna password"}
          </button>
        </div>
      </div>
    </div>
  );
}
