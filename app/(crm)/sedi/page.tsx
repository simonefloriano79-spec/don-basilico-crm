"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const fieldSt: React.CSSProperties = {
  width: "100%", background: "var(--surface-muted)", border: "1px solid var(--border)",
  color: "var(--text)", padding: "9px 12px", borderRadius: 9, fontSize: 12.5, outline: "none", fontFamily: "var(--font-ui)",
};
const labelSt: React.CSSProperties = {
  display: "block", fontSize: 10, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1.6,
};

function euro(n: number) {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

export default function SediPage() {
  const [sedi, setSedi] = useState<any[]>([]);
  const [sediStats, setSediStats] = useState<any[]>([]);
  const [utenti, setUtenti] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "", indirizzo: "", citta: "", telefono: "", email: "", slug: "",
    orarioApertura: "11:30", orarioChiusura: "23:00",
  });

  const slugSuggerito = useMemo(() => slugify(`${form.nome} ${form.citta}`), [form.nome, form.citta]);

  const carica = async () => {
    fetch("/api/sedi").then((r) => r.json()).then((d) => setSedi(Array.isArray(d) ? d : []));
    fetch("/api/stats").then((r) => r.json()).then((d) => setSediStats(d?.sediStats ?? []));
    fetch("/api/utenti").then((r) => (r.ok ? r.json() : [])).then((d) => setUtenti(Array.isArray(d) ? d : []));
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
    nome: "", indirizzo: "", citta: "", telefono: "", email: "", slug: "",
    orarioApertura: "11:30", orarioChiusura: "23:00",
  });

  const salva = async () => {
    const payload = {
      ...form,
      nome: form.nome.trim(), indirizzo: form.indirizzo.trim(), citta: form.citta.trim(),
      telefono: form.telefono.trim(), email: form.email.trim(),
      slug: (form.slug || slugSuggerito).trim(),
      orarioApertura: form.orarioApertura.trim() || "11:30",
      orarioChiusura: form.orarioChiusura.trim() || "23:00",
    };
    if (!payload.nome) return toast.error("Inserisci il nome della filiale, ad esempio Don Basilico Centro");
    if (!payload.indirizzo) return toast.error("Inserisci l'indirizzo della filiale");
    if (!payload.citta) return toast.error("Inserisci la città della filiale");

    setSaving(true);
    const res = await fetch("/api/sedi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (res.ok) { toast.success("Filiale creata correttamente"); setShowModal(false); resetForm(); carica(); return; }
    toast.error(data.error ?? "Errore durante la creazione della filiale");
  };

  return (
    <div className="animate-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, gap: 16, flexWrap: "wrap" }}>
        <p style={{ color: "var(--text-muted)", fontSize: 12.5, maxWidth: 640, lineHeight: 1.5 }}>
          Ogni punto vendita usa lo stesso menù base Don Basilico, con eventuali disponibilità specifiche per sede.
        </p>
        <button onClick={() => setShowModal(true)} style={{ background: "var(--text)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
          Aggiungi filiale
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {sedi.map((s) => {
          const stat = sediStats.find((x) => x.id === s.id);
          const nOperatori = utenti.filter((u) => u.sedeId === s.id).length;
          return (
            <div key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.attiva ? "var(--accent)" : "var(--danger)", flexShrink: 0 }} />
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text)", flex: 1 }}>{s.nome}</h3>
                  <span style={{
                    fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20,
                    background: s.attiva ? "var(--accent-bg)" : "var(--danger-bg)",
                    color: s.attiva ? "var(--accent-ink)" : "var(--danger)",
                  }}>{s.attiva ? "Aperta" : "Chiusa"}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.65 }}>
                  <div>{s.indirizzo}, {s.citta}</div>
                  {s.telefono && <div>{s.telefono}</div>}
                  <div>{s.orarioApertura} – {s.orarioChiusura}</div>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 18px", padding: "12px 0", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)" }}>
                {[
                  { label: "Oggi", value: stat ? String(stat.totaleOrdiniOggi) : "—" },
                  { label: "Incasso", value: stat ? euro(stat.incassoOggi) : "—" },
                  { label: "Operatori", value: String(nOperatori) },
                ].map((k) => (
                  <div key={k.label}>
                    <div style={{ fontSize: 9.5, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--text-muted)" }}>{k.label}</div>
                    <div className="num" style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginTop: 3 }}>{k.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <Link href={`/dashboard?sede=${s.id}`} style={{ flex: 1, textAlign: "center", textDecoration: "none", background: "var(--text)", color: "#fff", padding: "9px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, fontFamily: "var(--font-ui)" }}>
                  Apri sede
                </Link>
                <Link href={`/menu?sedeId=${s.id}`} style={{ flex: 1, textAlign: "center", textDecoration: "none", background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)", padding: "9px 12px", borderRadius: 9, fontSize: 12.5, fontFamily: "var(--font-ui)" }}>
                  Menù sede
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "24px 12px", overflowY: "auto", boxSizing: "border-box" }} onClick={() => setShowModal(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 26, width: 560, maxWidth: "92vw", maxHeight: "calc(100dvh - 48px)", overflowY: "auto", margin: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text)", marginBottom: 6 }}>Nuova filiale Don Basilico</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 12.5, marginBottom: 18 }}>Lo slug viene generato automaticamente; puoi modificarlo solo se ti serve un URL specifico.</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelSt}>Nome filiale *</label>
                <input autoFocus style={fieldSt} placeholder="Don Basilico Pescara Centro" value={form.nome} onChange={(e) => aggiornaCampo("nome", e.target.value)} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelSt}>Indirizzo *</label>
                <input style={fieldSt} placeholder="Via Roma 1" value={form.indirizzo} onChange={(e) => aggiornaCampo("indirizzo", e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>Città *</label>
                <input style={fieldSt} placeholder="Pescara" value={form.citta} onChange={(e) => aggiornaCampo("citta", e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>Telefono</label>
                <input style={fieldSt} placeholder="085 0000000" value={form.telefono} onChange={(e) => aggiornaCampo("telefono", e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>Email</label>
                <input style={fieldSt} placeholder="sede@donbasilico.it" value={form.email} onChange={(e) => aggiornaCampo("email", e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>Slug URL</label>
                <input style={fieldSt} placeholder={slugSuggerito || "pescara-est"} value={form.slug} onChange={(e) => aggiornaCampo("slug", e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>Apertura</label>
                <input style={fieldSt} value={form.orarioApertura} onChange={(e) => aggiornaCampo("orarioApertura", e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>Chiusura</label>
                <input style={fieldSt} value={form.orarioChiusura} onChange={(e) => aggiornaCampo("orarioChiusura", e.target.value)} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)", padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5 }}>Annulla</button>
              <button disabled={saving} onClick={salva} style={{ background: "var(--text)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 9, fontWeight: 500, cursor: saving ? "wait" : "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5 }}>
                {saving ? "Salvataggio…" : "Crea filiale"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
