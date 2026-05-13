"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

const CAT_COLORS: Record<string, string> = {
  pizze: "#c85a2e", fritti: "#d4a853", bevande: "#4a7ec8",
  dolci: "#4a9e6b", extra: "#8a7a65", menu_speciale: "#9b59b6",
};

export default function MenuPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<any[]>([]);
  const [catFiltro, setCatFiltro] = useState("tutti");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [sedi, setSedi] = useState<any[]>([]);
  const [sedeVisualizzata, setSedeVisualizzata] = useState("");
  const [form, setForm] = useState({ nome: "", descrizione: "", categoria: "pizze", prezzoBase: "" });
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";
  const sedeId = user?.sedeId;
  const sedeMenuId = isSuperAdmin ? sedeVisualizzata : sedeId;

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch("/api/sedi")
      .then((r) => r.json())
      .then((data) => {
        const elenco = Array.isArray(data) ? data : [];
        setSedi(elenco);
        const querySede = new URLSearchParams(window.location.search).get("sedeId") ?? "";
        if (querySede) setSedeVisualizzata(querySede);
      });
  }, [isSuperAdmin]);

  const caricaMenu = async () => {
    const url = sedeMenuId ? `/api/menu?sedeId=${sedeMenuId}` : "/api/menu";
    const res = await fetch(url);
    const data = await res.json();
    setItems(data.items ?? []);
  };

  useEffect(() => { caricaMenu(); }, [sedeMenuId]);

  const cats = ["tutti", ...Array.from(new Set(items.map((m) => m.categoria)))] as string[];
  const itemsFiltrati = items.filter((m) => catFiltro === "tutti" || m.categoria === catFiltro);

  const toggleDisponibilitaSede = async (item: any) => {
    if (!sedeId) return;
    const nuovaDisp = !item.disponibileInSede;
    const res = await fetch(`/api/menu/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sedeId, disponibile: nuovaDisp }),
    });
    if (res.ok) {
      toast.success(nuovaDisp ? "Prodotto riabilitato" : "Prodotto disabilitato in questa sede");
      caricaMenu();
    }
  };

  const toggleGlobale = async (item: any) => {
    const res = await fetch(`/api/menu/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAttivo: !item.isAttivo }),
    });
    if (res.ok) {
      toast.success(!item.isAttivo ? "Abilitato globalmente" : "Disabilitato globalmente");
      caricaMenu();
    }
  };

  const salva = async () => {
    if (!form.nome || !form.prezzoBase) return toast.error("Compila nome e prezzo");
    const url = editItem ? `/api/menu/${editItem.id}` : "/api/menu";
    const method = editItem ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, prezzoBase: parseFloat(form.prezzoBase) }),
    });
    if (res.ok) {
      toast.success(editItem ? "Prodotto aggiornato!" : "Prodotto aggiunto!");
      setShowModal(false);
      setEditItem(null);
      setForm({ nome: "", descrizione: "", categoria: "pizze", prezzoBase: "" });
      caricaMenu();
    }
  };

  return (
    <div className="animate-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {cats.map((c) => (
            <button key={c} onClick={() => setCatFiltro(c)} style={{
              padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
              border: "1px solid var(--border)", fontFamily: "var(--font-sans)",
              background: catFiltro === c ? `${CAT_COLORS[c] ?? "var(--terracotta)"}20` : "transparent",
              color: catFiltro === c ? (CAT_COLORS[c] ?? "var(--terracotta)") : "var(--text-dim)",
              borderColor: catFiltro === c ? (CAT_COLORS[c] ?? "var(--terracotta)") : "var(--border)",
            }}>{c}</button>
          ))}
        </div>
        {isSuperAdmin && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={sedeVisualizzata}
              onChange={(e) => setSedeVisualizzata(e.target.value)}
              style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}
            >
              <option value="">Menù base condiviso</option>
              {sedi.map((s) => <option key={s.id} value={s.id}>Vista filiale: {s.nome}</option>)}
            </select>
          <button
            onClick={() => { setShowModal(true); setEditItem(null); setForm({ nome: "", descrizione: "", categoria: "pizze", prezzoBase: "" }); }}
            style={{
              background: "var(--terracotta)", color: "white", border: "none",
              padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}
          >
            + Aggiungi prodotto
          </button>
          </div>
        )}
      </div>

      {(!isSuperAdmin || sedeVisualizzata) && (
        <div style={{
          background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.2)",
          borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#d4a853",
        }}>
          {isSuperAdmin
            ? "Vista filiale: stai verificando come il menù base condiviso viene applicato a questo punto vendita."
            : "Modalità sede: puoi disabilitare prodotti temporaneamente esauriti. Le modifiche globali sono gestite dall'admin."}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {itemsFiltrati.map((item) => {
          const dispSede = isSuperAdmin && !sedeVisualizzata ? true : item.disponibileInSede;
          const dispGlobale = item.isAttivo;
          const disabled = !dispSede || !dispGlobale;
          const catColor = CAT_COLORS[item.categoria] ?? "var(--text-dim)";
          const prezzo = item.prezzoEffettivo ?? parseFloat(item.prezzoBase);

          return (
            <div key={item.id} style={{
              background: "var(--surface)", border: `1px solid var(--border)`,
              borderRadius: 10, padding: 16, position: "relative", transition: "border 0.15s",
              opacity: disabled ? 0.45 : 1,
              borderStyle: disabled ? "dashed" : "solid",
            }}>
              {/* Actions */}
              <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 4 }}>
                {isSuperAdmin && (
                  <button onClick={() => toggleGlobale(item)} title="Attiva/disattiva globalmente" style={{
                    width: 28, height: 28, borderRadius: 6, border: `1px solid ${dispGlobale ? catColor : "var(--border)"}`,
                    background: dispGlobale ? `${catColor}15` : "var(--surface-high)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                  }}>🌍</button>
                )}
                {!isSuperAdmin && (
                  <button onClick={() => toggleDisponibilitaSede(item)} title="Disponibile/esaurito in questa sede" style={{
                    width: 28, height: 28, borderRadius: 6, border: `1px solid ${dispSede ? catColor : "var(--border)"}`,
                    background: dispSede ? `${catColor}15` : "rgba(200,64,64,0.1)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                    color: dispSede ? catColor : "#c84040",
                  }}>{dispSede ? "✓" : "✗"}</button>
                )}
              </div>

              <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  background: `${catColor}20`, color: catColor, padding: "2px 8px",
                  borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
                }}>{item.categoria}</span>
                {!dispGlobale && <span style={{ fontSize: 10, color: "#c84040" }}>● OFF</span>}
                {!dispSede && dispGlobale && <span style={{ fontSize: 10, color: "var(--text-dim)" }}>● esaurito</span>}
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--cream)", marginBottom: 4 }}>{item.nome}</div>
              {item.descrizione && (
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 10, lineHeight: 1.4 }}>{item.descrizione}</div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 500, color: "#d4a853" }}>€{prezzo.toFixed(2)}</span>
                {isSuperAdmin && (
                  <button onClick={() => { setEditItem(item); setForm({ nome: item.nome, descrizione: item.descrizione ?? "", categoria: item.categoria, prezzoBase: item.prezzoBase.toString() }); setShowModal(true); }} style={{
                    background: "var(--surface-high)", border: "1px solid var(--border)",
                    color: "var(--text-dim)", padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                  }}>✏️</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 440, maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700, color: "var(--cream)", marginBottom: 20 }}>
              {editItem ? "Modifica prodotto" : "Nuovo prodotto"}
            </h2>
            {[
              { label: "Nome *", key: "nome", type: "text", placeholder: "es. Margherita" },
              { label: "Descrizione", key: "descrizione", type: "text", placeholder: "es. Pomodoro, mozzarella, basilico" },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{f.label}</label>
                <input style={{ width: "100%", background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "9px 12px", borderRadius: 8, fontSize: 13, outline: "none" }}
                  type={f.type} placeholder={f.placeholder}
                  value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Categoria *</label>
                <select style={{ width: "100%", background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "9px 12px", borderRadius: 8, fontSize: 13 }}
                  value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}>
                  {["pizze", "fritti", "bevande", "dolci", "extra", "menu_speciale"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Prezzo (€) *</label>
                <input style={{ width: "100%", background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "9px 12px", borderRadius: 8, fontSize: 13 }}
                  type="number" step="0.50" placeholder="7.50"
                  value={form.prezzoBase} onChange={(e) => setForm((p) => ({ ...p, prezzoBase: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13 }}>Annulla</button>
              <button onClick={salva} style={{ background: "var(--terracotta)", color: "white", border: "none", padding: "8px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13 }}>
                {editItem ? "Salva" : "Aggiungi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
