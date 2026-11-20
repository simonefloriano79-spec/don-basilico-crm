"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

const CAT_LABEL: Record<string, string> = {
  pizze: "Pizze", pizze_rosse: "Pizze rosse", pizze_bianche: "Pizze bianche",
  calzoni: "Calzoni", fritti: "Fritti", bevande: "Bevande", dolci: "Dolci",
  extra: "Extra", menu_speciale: "Speciali", focacce: "Focacce", combo: "Menù Combo",
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

// Per ogni prodotto, in ogni sede, due interruttori separati (vedi lib/esauriti.ts):
//  - «In vendita»: permanente, lo gestisce liberamente ogni sede;
//  - «Esaurito»: vale fino alle 5:00 del giorno dopo, poi il prodotto torna disponibile da solo.
const inVendita = (item: any): boolean => item.attivoInSede ?? item.disponibileInSede;

export default function MenuPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<any[]>([]);
  const [sedi, setSedi] = useState<any[]>([]);
  const [sedeVista, setSedeVista] = useState("");
  const [catFiltro, setCatFiltro] = useState("tutti");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ nome: "", descrizione: "", categoria: "pizze_rosse", prezzoBase: "", prezzoOnline: "" });
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";
  const sedeId = isSuperAdmin ? sedeVista : user?.sedeId;

  useEffect(() => {
    if (isSuperAdmin) fetch("/api/sedi").then((r) => r.json()).then((d) => setSedi(Array.isArray(d) ? d : []));
  }, [isSuperAdmin]);

  const caricaMenu = async () => {
    const url = sedeId ? `/api/menu?sedeId=${sedeId}&tutti=1` : "/api/menu?tutti=1";
    const res = await fetch(url);
    const data = await res.json();
    setItems(data.items ?? []);
  };

  useEffect(() => { caricaMenu(); }, [sedeId]);

  const cats = ["tutti", ...Array.from(new Set(items.map((m) => m.categoria)))] as string[];
  const itemsFiltrati = items.filter((m) => catFiltro === "tutti" || m.categoria === catFiltro);

  // «In vendita» (permanente, solo questa sede). Disattivarlo toglie anche un eventuale «Esaurito».
  const toggleInVendita = async (item: any) => {
    if (!sedeId) return;
    const nuovo = !inVendita(item);
    const res = await fetch(`/api/menu/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sedeId, disponibile: nuovo }),
    });
    if (res.ok) { toast.success(nuovo ? "Di nuovo in vendita in questa sede" : "Non più in vendita in questa sede (resta così finché non lo riattivi)"); caricaMenu(); }
    else toast.error("Operazione non riuscita");
  };

  // «Esaurito»: nascosto ai clienti fino alle 5:00 del giorno dopo, poi torna disponibile da solo. Si può togliere subito.
  const toggleEsaurito = async (item: any) => {
    if (!sedeId) return;
    const nuovo = !item.esauritoOggi;
    const res = await fetch(`/api/menu/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sedeId, esaurito: nuovo }),
    });
    if (res.ok) { toast.success(nuovo ? "Esaurito: torna disponibile da solo alle 5:00 di domani" : "Di nuovo disponibile"); caricaMenu(); }
    else toast.error("Operazione non riuscita");
  };

  const toggleGlobale = async (item: any) => {
    if (item.isAttivo && !confirm(`Vuoi disattivare "${item.nome}"? Non sarà più ordinabile in nessuna sede finché non lo riattivi.`)) return;
    const res = await fetch(`/api/menu/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAttivo: !item.isAttivo }),
    });
    if (res.ok) { toast.success(!item.isAttivo ? "Abilitato globalmente" : "Disabilitato globalmente"); caricaMenu(); }
    else toast.error("Operazione non riuscita");
  };

  const salva = async () => {
    if (!form.nome || !form.prezzoBase) return toast.error("Compila nome e prezzo");
    const url = editItem ? `/api/menu/${editItem.id}` : "/api/menu";
    const method = editItem ? "PATCH" : "POST";
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, prezzoBase: parseFloat(form.prezzoBase), prezzoOnline: form.prezzoOnline.trim() === "" ? null : parseFloat(form.prezzoOnline) }),
    });
    if (res.ok) {
      toast.success(editItem ? "Prodotto aggiornato" : "Prodotto aggiunto");
      setShowModal(false); setEditItem(null);
      setForm({ nome: "", descrizione: "", categoria: "pizze_rosse", prezzoBase: "", prezzoOnline: "" });
      caricaMenu();
    }
  };

  return (
    <div className="animate-in">
      {isSuperAdmin && (
        <div style={{ marginBottom: 14 }}>
          <select value={sedeVista} onChange={(e) => setSedeVista(e.target.value)} style={{ ...fieldSt, background: "#fff", width: 260 }}>
            <option value="">Tutte le sedi (vista globale)</option>
            {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          {sedeVista && (
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
              Stai gestendo solo questa sede. «In vendita» è permanente; «Esaurito» dura fino alle 5:00 del giorno dopo e poi il prodotto torna disponibile da solo. Per disattivarlo ovunque usa "Attivo globale".
            </div>
          )}
        </div>
      )}

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
            onClick={() => { setShowModal(true); setEditItem(null); setForm({ nome: "", descrizione: "", categoria: "pizze_rosse", prezzoBase: "", prezzoOnline: "" }); }}
            style={{ background: "var(--text)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)" }}
          >Nuova voce</button>
        )}
      </div>

      {!isSuperAdmin && (
        <div style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)", borderRadius: 9, padding: "10px 16px", marginBottom: 16, fontSize: 12.5, color: "var(--accent-ink)" }}>
          Modalità sede: per ogni prodotto puoi scegliere «In vendita» (permanente, finché non lo cambi) ed «Esaurito» (nascosto fino alle 5:00 del giorno dopo, poi torna da solo). Le modifiche globali sono gestite dall'admin.
        </div>
      )}

      {/* Da telefono: una scheda per prodotto, con tutti i comandi visibili (la tabella resta solo su schermi larghi). */}
      <div className="menu-cards-mobile" style={{ display: "none" }}>
        {itemsFiltrati.map((item) => {
          const prezzo = item.prezzoEffettivo ?? parseFloat(item.prezzoBase);
          const chip = (attivo: boolean): React.CSSProperties => ({
            padding: "6px 13px", borderRadius: 20, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
            border: `1px solid ${attivo ? "var(--accent-border)" : "var(--danger-border)"}`,
            background: attivo ? "var(--accent-bg-2)" : "var(--danger-bg)",
            color: attivo ? "var(--accent-ink)" : "var(--danger)",
            fontFamily: "var(--font-ui)",
          });
          return (
            <div key={item.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", opacity: item.isAttivo ? 1 : 0.7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text)" }}>{item.nome}</div>
                  <div style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 2 }}>{CAT_LABEL[item.categoria] ?? item.categoria}</div>
                </div>
                <div className="num" style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>{euro(prezzo)}</div>
              </div>
              {item.descrizione && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>{item.descrizione}</div>}
              {item.prezzoOnline != null && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 11, background: "var(--accent-bg-2)", border: "1px solid var(--accent-border)", borderRadius: 20, padding: "1px 8px", color: "var(--text-2)" }}>app € {parseFloat(item.prezzoOnline).toFixed(2).replace(".", ",")}</span>
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                <button onClick={() => isSuperAdmin && toggleGlobale(item)} disabled={!isSuperAdmin} style={{ ...chip(item.isAttivo), cursor: isSuperAdmin ? "pointer" : "default" }}>
                  {item.isAttivo ? "Attivo" : "Disattivato"}
                </button>
                {sedeId && (
                  <button onClick={() => toggleInVendita(item)} style={{ ...chip(inVendita(item)), cursor: "pointer" }}>
                    {inVendita(item) ? "In vendita" : "Non in vendita"}
                  </button>
                )}
                {sedeId && inVendita(item) && (
                  <button onClick={() => toggleEsaurito(item)} style={item.esauritoOggi
                    ? { ...chip(false), cursor: "pointer" }
                    : { background: "#fff", border: "1px solid var(--border)", color: "var(--text-3)", padding: "6px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)", whiteSpace: "nowrap" }}>
                    {item.esauritoOggi ? "Esaurito · torna domani" : "Segna esaurito"}
                  </button>
                )}
                {isSuperAdmin && (
                  <button onClick={() => { setEditItem(item); setForm({ nome: item.nome, descrizione: item.descrizione ?? "", categoria: item.categoria, prezzoBase: item.prezzoBase.toString(), prezzoOnline: item.prezzoOnline != null ? item.prezzoOnline.toString() : "" }); setShowModal(true); }} style={{
                    background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)",
                    padding: "6px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)", marginLeft: "auto",
                  }}>Modifica</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="menu-table-desktop" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)" }}>
              {["Prodotto", "Categoria", "Prezzo base", "Attivo globale", ...(sedeId ? ["In vendita qui", "Esaurito oggi"] : []), ...(isSuperAdmin ? [""] : [])].map((h, i) => (
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text)" }}>{item.nome}</span>
                      {item.prezzoOnline != null && <span title="Prezzo per l'app online" style={{ fontSize: 11, background: "var(--accent-bg-2)", border: "1px solid var(--accent-border)", borderRadius: 20, padding: "1px 8px", color: "var(--text-2)" }}>app € {parseFloat(item.prezzoOnline).toFixed(2).replace(".", ",")}</span>}
                      {!item.isAttivo && (
                        <span
                          onClick={() => isSuperAdmin && toggleGlobale(item)}
                          title={isSuperAdmin ? "Tocca per riattivare" : undefined}
                          style={{
                            opacity: 1, fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase",
                            padding: "2px 8px", borderRadius: 20, background: "var(--danger)", color: "#fff", flexShrink: 0,
                            cursor: isSuperAdmin ? "pointer" : "default",
                          }}>Disattivato</span>
                      )}
                    </div>
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
                        fontFamily: "var(--font-ui)", whiteSpace: "nowrap",
                      }}
                    >{item.isAttivo ? "Attivo" : "Disattivo"}</button>
                  </td>
                  {sedeId && (
                    <td style={{ padding: "13px 14px" }}>
                      <button onClick={() => toggleInVendita(item)} title="Permanente: resta così finché non lo cambi" style={{
                        padding: "5px 13px", borderRadius: 20, fontSize: 11.5, fontWeight: 500, cursor: "pointer",
                        border: `1px solid ${inVendita(item) ? "var(--accent-border)" : "var(--danger-border)"}`,
                        background: inVendita(item) ? "var(--accent-bg-2)" : "var(--danger-bg)",
                        color: inVendita(item) ? "var(--accent-ink)" : "var(--danger)",
                        fontFamily: "var(--font-ui)", whiteSpace: "nowrap",
                      }}>{inVendita(item) ? "In vendita" : "Non in vendita"}</button>
                    </td>
                  )}
                  {sedeId && (
                    <td style={{ padding: "13px 14px" }}>
                      {inVendita(item) ? (
                        <button onClick={() => toggleEsaurito(item)} title="Nascosto ai clienti fino alle 5:00 del giorno dopo, poi torna da solo" style={{
                          padding: "5px 13px", borderRadius: 20, fontSize: 11.5, fontWeight: 500, cursor: "pointer",
                          border: `1px solid ${item.esauritoOggi ? "var(--danger-border)" : "var(--border)"}`,
                          background: item.esauritoOggi ? "var(--danger-bg)" : "#fff",
                          color: item.esauritoOggi ? "var(--danger)" : "var(--text-3)",
                          fontFamily: "var(--font-ui)", whiteSpace: "nowrap",
                        }}>{item.esauritoOggi ? "Esaurito · torna domani" : "Segna esaurito"}</button>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  )}
                  {isSuperAdmin && (
                    <td style={{ padding: "13px 14px", textAlign: "right" }}>
                      <button onClick={() => { setEditItem(item); setForm({ nome: item.nome, descrizione: item.descrizione ?? "", categoria: item.categoria, prezzoBase: item.prezzoBase.toString(), prezzoOnline: item.prezzoOnline != null ? item.prezzoOnline.toString() : "" }); setShowModal(true); }} style={{
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
                  {["combo", "pizze_rosse", "pizze_bianche", "calzoni", "focacce", "menu_speciale", "fritti", "bevande", "dolci", "extra"].map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Prezzo (€) *</label>
                <input style={fieldSt} type="number" step="0.50" placeholder="7.50" value={form.prezzoBase} onChange={(e) => setForm((p) => ({ ...p, prezzoBase: e.target.value }))} />
              </div>
              <div>
                <label style={labelSt}>Prezzo app (€) — facoltativo</label>
                <input style={fieldSt} type="number" step="0.50" placeholder="uguale al prezzo di cassa" value={form.prezzoOnline} onChange={(e) => setForm((p) => ({ ...p, prezzoOnline: e.target.value }))} />
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Se lo compili, l'app ordini e il menù pubblico usano questo; la cassa usa sempre il prezzo qui sopra.</div>
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
