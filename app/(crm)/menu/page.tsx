"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

const CAT_LABEL: Record<string, string> = {
  pizze: "Pizze", pizze_rosse: "Pizze rosse", pizze_bianche: "Pizze bianche",
  calzoni: "Calzoni", fritti: "Fritti", bevande: "Bevande", dolci: "Dolci",
  extra: "Extra", menu_speciale: "Menù speciale",
};

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

export default function MenuPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<any[]>([]);
  const [catFiltro, setCatFiltro] = useState("tutti");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ nome: "", descrizione: "", categoria: "pizze_rosse", prezzoBase: "" });
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";
  const sedeId = user?.sedeId;

  const caricaMenu = async () => {
    const url = sedeId ? `/api/menu?sedeId=${sedeId}` : "/api/menu";
    const res = await fetch(url);
    const data = await res.json();
    setItems(data.items ?? []);
  };

  useEffect(() => { caricaMenu(); }, [sedeId]);

  const cats = ["tutti", ...Array.from(new Set(items.map((m) => m.categoria)))] as string[];
  const itemsFiltrati = items.filter((m) => catFiltro === "tutti" || m.categoria === catFiltro);

  const toggleDisponibilitaSede = async (item: any) => {
    if (!sedeId) return;
    const nuovaDisp = !item.disponibileInSede;
    const res = await fetch(`/api/menu/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sedeId, disponibile: nuovaDisp }),
    });
    if (res.ok) { toast.success(nuovaDisp ? "Prodotto riabilitato" : "Prodotto disabilitato in questa sede"); caricaMenu(); }
  };

  const toggleGlobale = async (item: any) => {
    const res = await fetch(`/api/menu/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAttivo: !item.isAttivo }),
    });
    if (res.ok) { toast.success(!item.isAttivo ? "Abilitato globalmente" : "Disabilitato globalmente"); caricaMenu(); }
  };

  const salva = async () => {
    if (!form.nome || !form.prezzoBase) return toast.error("Compila nome e prezzo");
    const url = editItem ? `/api/menu/${editItem.id}` : "/api/menu";
    const method = editItem ? "PATCH" : "POST";
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, prezzoBase: parseFloat(form.prezzoBase) }),
    });
    if (res.ok) {
      toast.success(editItem ? "Prodotto aggiornato" : "Prodotto aggiunto");
      setShowModal(false); setEditItem(null);
      setForm({ nome: "", descrizione: "", categoria: "pizze_rosse", prezzoBase: "" });
      caricaMenu();
    }
  };

  return (
    <div className="animate-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {cats.map((c) => (
            <button key={c} onClick={() => setCatFiltro(c)} style={{
              padding: "8px 15px", borderRadius: 20, fontSize: 12.5, cursor: "pointer",
              border: `1px solid ${catFiltro === c ? "var(--text)" : "var(--border)"}`,
              background: catFiltro === c ? "var(--text)" : "#fff",
              color: catFiltro === c ? "#fff" : "var(--text-3)",
              fontFamily: "var(--font-ui)",
            }}>{c === "tutti" ? "Tutti" : CAT_LABEL[c] ?? c}</button>
          ))}
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => { setShowModal(true); setEditItem(null); setForm({ nome: "", descrizione: "", categoria: "pizze_rosse", prezzoBase: "" }); }}
            style={{ background: "var(--text)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)" }}
          >Nuova voce</button>
        )}
      </div>

      {!isSuperAdmin && (
        <div style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)", borderRadius: 9, padding: "10px 16px", marginBottom: 16, fontSize: 12.5, color: "var(--accent-ink)" }}>
          Modalità sede: puoi disabilitare prodotti temporaneamente esauriti. Le modifiche globali sono gestite dall'admin.
        </div>
      )}

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)" }}>
              {["Prodotto", "Categoria", "Prezzo base", "Attivo globale", ...(!isSuperAdmin ? ["In questa sede"] : []), ...(isSuperAdmin ? [""] : [])].map((h, i) => (
                <th key={i} style={{ padding: "11px 14px", textAlign: "left", fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itemsFiltrati.map((item) => {
              const prezzo = item.prezzoEffettivo ?? parseFloat(item.prezzoBase);
              return (
                <tr key={item.id} style={{ borderTop: "1px solid var(--border-soft)", opacity: item.isAttivo ? 1 : 0.55 }}>
                  <td style={{ padding: "13px 14px" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text)" }}>{item.nome}</div>
                    {item.descrizione && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{item.descrizione}</div>}
                  </td>
                  <td style={{ padding: "13px 14px" }}>
                    <span style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>{CAT_LABEL[item.categoria] ?? item.categoria}</span>
                  </td>
                  <td className="num" style={{ padding: "13px 14px", fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{euro(prezzo)}</td>
                  <td style={{ padding: "13px 14px" }}>
                    <button
                      onClick={() => isSuperAdmin && toggleGlobale(item)}
                      disabled={!isSuperAdmin}
                      style={{
                        padding: "5px 13px", borderRadius: 20, fontSize: 11.5, fontWeight: 500, cursor: isSuperAdmin ? "pointer" : "default",
                        border: `1px solid ${item.isAttivo ? "var(--accent-border)" : "var(--danger-border)"}`,
                        background: item.isAttivo ? "var(--accent-bg-2)" : "var(--danger-bg)",
                        color: item.isAttivo ? "var(--accent-ink)" : "var(--danger)",
                        fontFamily: "var(--font-ui)",
                      }}
                    >{item.isAttivo ? "Attivo" : "Disattivo"}</button>
                  </td>
                  {!isSuperAdmin && (
                    <td style={{ padding: "13px 14px" }}>
                      <button onClick={() => toggleDisponibilitaSede(item)} style={{
                        padding: "5px 13px", borderRadius: 20, fontSize: 11.5, fontWeight: 500, cursor: "pointer",
                        border: `1px solid ${item.disponibileInSede ? "var(--accent-border)" : "var(--danger-border)"}`,
                        background: item.disponibileInSede ? "var(--accent-bg-2)" : "var(--danger-bg)",
                        color: item.disponibileInSede ? "var(--accent-ink)" : "var(--danger)",
                        fontFamily: "var(--font-ui)",
                      }}>{item.disponibileInSede ? "Disponibile" : "Esaurito"}</button>
                    </td>
                  )}
                  {isSuperAdmin && (
                    <td style={{ padding: "13px 14px", textAlign: "right" }}>
                      <button onClick={() => { setEditItem(item); setForm({ nome: item.nome, descrizione: item.descrizione ?? "", categoria: item.categoria, prezzoBase: item.prezzoBase.toString() }); setShowModal(true); }} style={{
                        background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)",
                        padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)",
                      }}>Modifica</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 26, width: 440, maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text)", marginBottom: 18 }}>
              {editItem ? "Modifica prodotto" : "Nuovo prodotto"}
            </h2>
            {[
              { label: "Nome *", key: "nome", placeholder: "es. Margherita" },
              { label: "Descrizione", key: "descrizione", placeholder: "es. Pomodoro, mozzarella, basilico" },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={labelSt}>{f.label}</label>
                <input style={fieldSt} placeholder={f.placeholder} value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelSt}>Categoria *</label>
                <select style={fieldSt} value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}>
                  {["pizze_rosse", "pizze_bianche", "calzoni", "fritti", "bevande", "dolci", "extra", "menu_speciale"].map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Prezzo (€) *</label>
                <input style={fieldSt} type="number" step="0.50" placeholder="7.50" value={form.prezzoBase} onChange={(e) => setForm((p) => ({ ...p, prezzoBase: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)", padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5 }}>Annulla</button>
              <button onClick={salva} style={{ background: "var(--text)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
                {editItem ? "Salva" : "Aggiungi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
