"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--surface-high)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  padding: "9px 12px",
  borderRadius: 8,
  fontSize: 13,
  outline: "none",
  fontFamily: "var(--font-sans)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--text-dim)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

export default function SediPage() {
  const [sedi, setSedi] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    indirizzo: "",
    citta: "",
    telefono: "",
    email: "",
    slug: "",
    orarioApertura: "11:30",
    orarioChiusura: "23:00",
  });

  const slugSuggerito = useMemo(() => slugify(`${form.nome} ${form.citta}`), [form.nome, form.citta]);

  const carica = async () => {
    const res = await fetch("/api/sedi");
    const data = await res.json();
    setSedi(Array.isArray(data) ? data : []);
  };

  useEffect(() => { carica(); }, []);

  const aggiornaCampo = (key: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if ((key === "nome" || key === "citta") && (!prev.slug || prev.slug === slugSuggerito)) {
        next.slug = slugify(`${key === "nome" ? value : next.nome} ${key === "citta" ? value : next.citta}`);
      }
      if (key === "slug") next.slug = slugify(value);
      return next;
    });
  };

  const resetForm = () => setForm({
    nome: "",
    indirizzo: "",
    citta: "",
    telefono: "",
    email: "",
    slug: "",
    orarioApertura: "11:30",
    orarioChiusura: "23:00",
  });

  const salva = async () => {
    const payload = {
      ...form,
      nome: form.nome.trim(),
      indirizzo: form.indirizzo.trim(),
      citta: form.citta.trim(),
      telefono: form.telefono.trim(),
      email: form.email.trim(),
      slug: (form.slug || slugSuggerito).trim(),
      orarioApertura: form.orarioApertura.trim() || "11:30",
      orarioChiusura: form.orarioChiusura.trim() || "23:00",
    };

    if (!payload.nome) {
      return toast.error("Inserisci il nome della filiale, ad esempio Don Basilico Centro");
    }
    if (!payload.indirizzo) {
      return toast.error("Inserisci l’indirizzo della filiale");
    }
    if (!payload.citta) {
      return toast.error("Inserisci la città della filiale");
    }

    setSaving(true);
    const res = await fetch("/api/sedi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (res.ok) {
      toast.success("Filiale creata correttamente");
      setShowModal(false);
      resetForm();
      carica();
      return;
    }

    toast.error(data.error ?? "Errore durante la creazione della filiale");
  };

  return (
    <div className="animate-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", color: "var(--cream)", fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Filiali e punti vendita</h1>
          <p style={{ color: "var(--text-dim)", fontSize: 13, maxWidth: 720, lineHeight: 1.5 }}>
            Da qui il Super Admin crea le filiali. Ogni punto vendita usa lo stesso menù base Don Basilico, con eventuali disponibilità specifiche per sede.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: "var(--terracotta)", color: "white", border: "none", padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
          + Aggiungi filiale
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {sedi.map((s) => (
          <div key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.attiva ? "#4a9e6b" : "#c84040" }} />
                  <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 700, color: "var(--cream)" }}>{s.nome}</h3>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Slug operativo: <span style={{ fontFamily: "var(--font-mono)", color: "#d4a853" }}>{s.slug}</span></div>
              </div>
              <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, border: "1px solid var(--border)", color: "var(--text-dim)", borderRadius: 999, padding: "4px 8px" }}>Filiale</span>
            </div>

            <div style={{ display: "grid", gap: 5, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.45 }}>
              <div>{s.indirizzo}, {s.citta}</div>
              {s.telefono && <div>Telefono: {s.telefono}</div>}
              {s.email && <div>Email: {s.email}</div>}
              <div>Orario: {s.orarioApertura} - {s.orarioChiusura}</div>
            </div>

            <div style={{ background: "rgba(212,168,83,0.08)", border: "1px solid rgba(212,168,83,0.18)", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: "#d4a853", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Pannello operativo punto vendita</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Link href={`/nuovo-ordine?sedeId=${s.id}`} style={{ textAlign: "center", textDecoration: "none", background: "var(--terracotta)", color: "white", padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                  Nuovo ordine
                </Link>
                <Link href={`/menu?sedeId=${s.id}`} style={{ textAlign: "center", textDecoration: "none", background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                  Menù sede
                </Link>
                <Link href="/utenti" style={{ gridColumn: "1 / -1", textAlign: "center", textDecoration: "none", background: "transparent", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "7px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                  Gestisci operatori assegnati
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)", padding: "24px 12px", overflowY: "auto", boxSizing: "border-box" }} onClick={() => setShowModal(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 560, maxWidth: "92vw", maxHeight: "calc(100dvh - 48px)", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.45)", margin: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 21, fontWeight: 700, color: "var(--cream)", marginBottom: 6 }}>Nuova filiale Don Basilico</h2>
            <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 20 }}>Lo slug viene generato automaticamente; puoi modificarlo solo se ti serve un URL specifico.</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Nome filiale *</label>
                <input autoFocus style={inputStyle} placeholder="Don Basilico Pescara Centro" value={form.nome} onChange={(e) => aggiornaCampo("nome", e.target.value)} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Indirizzo *</label>
                <input style={inputStyle} placeholder="Via Roma 1" value={form.indirizzo} onChange={(e) => aggiornaCampo("indirizzo", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Città *</label>
                <input style={inputStyle} placeholder="Pescara" value={form.citta} onChange={(e) => aggiornaCampo("citta", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Telefono</label>
                <input style={inputStyle} placeholder="085 0000000" value={form.telefono} onChange={(e) => aggiornaCampo("telefono", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} placeholder="sede@donbasilico.it" value={form.email} onChange={(e) => aggiornaCampo("email", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Slug URL</label>
                <input style={inputStyle} placeholder={slugSuggerito || "pescara-est"} value={form.slug} onChange={(e) => aggiornaCampo("slug", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Apertura</label>
                <input style={inputStyle} value={form.orarioApertura} onChange={(e) => aggiornaCampo("orarioApertura", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Chiusura</label>
                <input style={inputStyle} value={form.orarioChiusura} onChange={(e) => aggiornaCampo("orarioChiusura", e.target.value)} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
              <button onClick={() => setShowModal(false)} style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "9px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13 }}>Annulla</button>
              <button disabled={saving} onClick={salva} style={{ background: saving ? "var(--surface-high)" : "var(--terracotta)", color: "white", border: "none", padding: "9px 20px", borderRadius: 8, fontWeight: 700, cursor: saving ? "wait" : "pointer", fontFamily: "var(--font-sans)", fontSize: 13 }}>
                {saving ? "Salvataggio..." : "Crea filiale"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
