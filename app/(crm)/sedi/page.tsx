"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function SediPage() {
  const [sedi, setSedi] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nome: "", indirizzo: "", citta: "", telefono: "", slug: "" });

  const carica = () => fetch("/api/sedi").then((r) => r.json()).then(setSedi);
  useEffect(() => { carica(); }, []);

  const salva = async () => {
    if (!form.nome || !form.indirizzo || !form.citta || !form.slug) return toast.error("Compila tutti i campi obbligatori");
    const res = await fetch("/api/sedi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { toast.success("Sede aggiunta!"); setShowModal(false); setForm({ nome: "", indirizzo: "", citta: "", telefono: "", slug: "" }); carica(); }
    else toast.error("Errore");
  };

  return (
    <div className="animate-in">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setShowModal(true)} style={{ background: "var(--terracotta)", color: "white", border: "none", padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
          + Aggiungi sede
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {sedi.map((s) => (
          <div key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4a9e6b" }} />
                <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 700, color: "var(--cream)" }}>{s.nome}</h3>
              </div>
              <button style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)" }}>✏️ Modifica</button>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 4 }}>📍 {s.indirizzo}, {s.citta}</div>
            {s.telefono && <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 4 }}>📞 {s.telefono}</div>}
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>🔗 /ordine/{s.slug}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)" }}>👥 Operatori</button>
              <button style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)" }}>📋 Menù sede</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowModal(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 480, maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700, color: "var(--cream)", marginBottom: 20 }}>Nuova sede</h2>
            {[
              { label: "Nome *", key: "nome", placeholder: "Don Basilico Pescara Est" },
              { label: "Indirizzo *", key: "indirizzo", placeholder: "Via Roma 1" },
              { label: "Città *", key: "citta", placeholder: "Pescara" },
              { label: "Telefono", key: "telefono", placeholder: "085-0000000" },
              { label: "Slug URL *", key: "slug", placeholder: "pescara-est" },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, color: "var(--text-dim)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{f.label}</label>
                <input style={{ width: "100%", background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", borderRadius: 8, fontSize: 13, outline: "none" }}
                  placeholder={f.placeholder} value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={() => setShowModal(false)} style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13 }}>Annulla</button>
              <button onClick={salva} style={{ background: "var(--terracotta)", color: "white", border: "none", padding: "8px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13 }}>Aggiungi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
