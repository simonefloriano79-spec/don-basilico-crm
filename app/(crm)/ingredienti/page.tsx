"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

export default function IngredientiPage() {
  const { data: session } = useSession();
  const [ingredienti, setIngredienti] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", prezzoAggiunta: "", isAllergene: false });
  const [showNuovo, setShowNuovo] = useState(false);
  const [nuovoForm, setNuovoForm] = useState({ nome: "", prezzoAggiunta: "0.00", isAllergene: false });
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";
  const sedeId = user?.sedeId;

  const carica = useCallback(async () => {
    const url = sedeId ? `/api/ingredienti?sedeId=${sedeId}` : "/api/ingredienti";
    const res = await fetch(url);
    const data = await res.json();
    setIngredienti(Array.isArray(data) ? data : []);
  }, [sedeId]);

  useEffect(() => { carica(); }, [carica]);

  const salvaPrezzoAdmin = async (id: string) => {
    const res = await fetch(`/api/ingredienti/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: editForm.nome,
        prezzoAggiunta: parseFloat(editForm.prezzoAggiunta),
        isAllergene: editForm.isAllergene,
      }),
    });
    if (res.ok) {
      toast.success("Ingrediente aggiornato!");
      setEditingId(null);
      carica();
    } else {
      toast.error("Errore nel salvataggio");
    }
  };

  const toggleDisabilitatoSede = async (ing: any) => {
    const disabilita = !ing.disabilitatoInSede;
    const res = await fetch(`/api/ingredienti/${ing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sedeId, disabilita }),
    });
    if (res.ok) {
      toast.success(disabilita ? `"${ing.nome}" segnato come esaurito` : `"${ing.nome}" ripristinato`);
      carica();
    }
  };

  const aggiungiIngrediente = async () => {
    if (!nuovoForm.nome) return toast.error("Inserisci un nome");
    const res = await fetch("/api/ingredienti", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: nuovoForm.nome,
        prezzoAggiunta: parseFloat(nuovoForm.prezzoAggiunta),
        isAllergene: nuovoForm.isAllergene,
      }),
    });
    if (res.ok) {
      toast.success("Ingrediente aggiunto!");
      setShowNuovo(false);
      setNuovoForm({ nome: "", prezzoAggiunta: "0.00", isAllergene: false });
      carica();
    }
  };

  const filtrati = ingredienti.filter(i =>
    i.nome.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (ing: any) => {
    setEditingId(ing.id);
    setEditForm({
      nome: ing.nome,
      prezzoAggiunta: ing.prezzoAggiunta?.toString() ?? "0.00",
      isAllergene: ing.isAllergene,
    });
  };

  return (
    <div className="animate-in">
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", fontSize: 14 }}>🔍</span>
          <input
            style={{ width: "100%", background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px 8px 34px", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "var(--font-sans)" }}
            placeholder="Cerca ingrediente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{filtrati.length} ingredienti</span>
          {isSuperAdmin && (
            <button onClick={() => setShowNuovo(true)} style={{ background: "var(--terracotta)", color: "white", border: "none", padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
              + Nuovo ingrediente
            </button>
          )}
        </div>
      </div>

      {/* INFO BANNER */}
      {!isSuperAdmin && (
        <div style={{ background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#d4a853" }}>
          💡 Puoi segnare un ingrediente come <strong>esaurito</strong> — verrà disabilitato solo per la tua sede. I prezzi sono gestiti dall&apos;admin.
        </div>
      )}
      {isSuperAdmin && (
        <div style={{ background: "rgba(74,126,200,0.1)", border: "1px solid rgba(74,126,200,0.2)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#4a7ec8" }}>
          💡 Modifica il <strong>prezzo di aggiunta</strong> di ogni ingrediente. Verrà applicato automaticamente quando un cliente aggiunge l&apos;ingrediente extra a una pizza.
        </div>
      )}

      {/* TABELLA */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-high)" }}>
              <th style={thStyle}>Ingrediente</th>
              <th style={thStyle}>Prezzo aggiunta</th>
              <th style={thStyle}>Allergene</th>
              {!isSuperAdmin && <th style={thStyle}>Disponibile</th>}
              {isSuperAdmin && <th style={thStyle}>Azioni</th>}
            </tr>
          </thead>
          <tbody>
            {filtrati.map((ing) => (
              <tr key={ing.id} style={{ borderTop: "1px solid var(--border)", opacity: ing.disabilitatoInSede ? 0.5 : 1 }}>
                <td style={tdStyle}>
                  {editingId === ing.id ? (
                    <input
                      style={inputStyle}
                      value={editForm.nome}
                      onChange={e => setEditForm(p => ({ ...p, nome: e.target.value }))}
                    />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      {ing.nome}
                      {ing.disabilitatoInSede && (
                        <span style={{ marginLeft: 8, fontSize: 10, background: "rgba(200,64,64,0.15)", color: "#c84040", padding: "2px 6px", borderRadius: 4 }}>ESAURITO</span>
                      )}
                    </span>
                  )}
                </td>
                <td style={tdStyle}>
                  {editingId === ing.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: "var(--text-dim)", fontSize: 13 }}>€</span>
                      <input
                        style={{ ...inputStyle, width: 80, fontFamily: "var(--font-mono)" }}
                        type="number"
                        step="0.10"
                        min="0"
                        value={editForm.prezzoAggiunta}
                        onChange={e => setEditForm(p => ({ ...p, prezzoAggiunta: e.target.value }))}
                      />
                    </div>
                  ) : (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: parseFloat(ing.prezzoAggiunta) > 0 ? "#d4a853" : "var(--text-dim)" }}>
                      {parseFloat(ing.prezzoAggiunta) > 0 ? `+ €${parseFloat(ing.prezzoAggiunta).toFixed(2)}` : "incluso"}
                    </span>
                  )}
                </td>
                <td style={tdStyle}>
                  {editingId === ing.id ? (
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                      <input type="checkbox" checked={editForm.isAllergene} onChange={e => setEditForm(p => ({ ...p, isAllergene: e.target.checked }))} />
                      Sì
                    </label>
                  ) : (
                    <span style={{ fontSize: 12, color: ing.isAllergene ? "#c85a2e" : "var(--text-dim)" }}>
                      {ing.isAllergene ? "⚠️ Sì" : "—"}
                    </span>
                  )}
                </td>

                {/* COLONNA DISPONIBILE — solo operatore sede */}
                {!isSuperAdmin && (
                  <td style={tdStyle}>
                    <button
                      onClick={() => toggleDisabilitatoSede(ing)}
                      style={{
                        padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                        border: "none", fontFamily: "var(--font-sans)",
                        background: ing.disabilitatoInSede ? "rgba(200,64,64,0.15)" : "rgba(74,158,107,0.15)",
                        color: ing.disabilitatoInSede ? "#c84040" : "#4a9e6b",
                      }}
                    >
                      {ing.disabilitatoInSede ? "✗ Esaurito" : "✓ Disponibile"}
                    </button>
                  </td>
                )}

                {/* COLONNA AZIONI — solo admin */}
                {isSuperAdmin && (
                  <td style={tdStyle}>
                    {editingId === ing.id ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => salvaPrezzoAdmin(ing.id)} style={btnSaveStyle}>✓ Salva</button>
                        <button onClick={() => setEditingId(null)} style={btnCancelStyle}>✗</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(ing)} style={btnEditStyle}>✏️ Modifica</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL NUOVO INGREDIENTE */}
      {showNuovo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}
          onClick={() => setShowNuovo(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 400, maxWidth: "90vw" }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700, color: "var(--cream)", marginBottom: 20 }}>Nuovo ingrediente</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Nome *</label>
              <input style={{ ...inputStyle, width: "100%" }} placeholder="es. Nduja" value={nuovoForm.nome} onChange={e => setNuovoForm(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Prezzo aggiunta (€)</label>
              <input style={{ ...inputStyle, width: "100%", fontFamily: "var(--font-mono)" }} type="number" step="0.10" min="0" value={nuovoForm.prezzoAggiunta} onChange={e => setNuovoForm(p => ({ ...p, prezzoAggiunta: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text)" }}>
                <input type="checkbox" checked={nuovoForm.isAllergene} onChange={e => setNuovoForm(p => ({ ...p, isAllergene: e.target.checked }))} />
                È un allergene
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowNuovo(false)} style={btnCancelStyle}>Annulla</button>
              <button onClick={aggiungiIngrediente} style={{ background: "var(--terracotta)", color: "white", border: "none", padding: "8px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13 }}>Aggiungi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Stili inline riutilizzabili
const thStyle: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-dim)", fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: "10px 16px", verticalAlign: "middle" };
const inputStyle: React.CSSProperties = { background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 10px", borderRadius: 6, fontSize: 13, outline: "none", fontFamily: "var(--font-sans)" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, color: "var(--text-dim)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 };
const btnSaveStyle: React.CSSProperties = { background: "rgba(74,158,107,0.15)", border: "1px solid rgba(74,158,107,0.3)", color: "#4a9e6b", padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)" };
const btnCancelStyle: React.CSSProperties = { background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)" };
const btnEditStyle: React.CSSProperties = { background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)" };
