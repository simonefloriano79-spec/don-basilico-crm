"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

function euro(n: number) {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

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
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: editForm.nome, prezzoAggiunta: parseFloat(editForm.prezzoAggiunta), isAllergene: editForm.isAllergene }),
    });
    if (res.ok) { toast.success("Ingrediente aggiornato"); setEditingId(null); carica(); }
    else toast.error("Errore nel salvataggio");
  };

  const toggleDisabilitatoSede = async (ing: any) => {
    const disabilita = !ing.disabilitatoInSede;
    const res = await fetch(`/api/ingredienti/${ing.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sedeId, disabilita }),
    });
    if (res.ok) { toast.success(disabilita ? `"${ing.nome}" segnato come esaurito` : `"${ing.nome}" ripristinato`); carica(); }
  };

  const aggiungiIngrediente = async () => {
    if (!nuovoForm.nome) return toast.error("Inserisci un nome");
    const res = await fetch("/api/ingredienti", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nuovoForm.nome, prezzoAggiunta: parseFloat(nuovoForm.prezzoAggiunta), isAllergene: nuovoForm.isAllergene }),
    });
    if (res.ok) { toast.success("Ingrediente aggiunto"); setShowNuovo(false); setNuovoForm({ nome: "", prezzoAggiunta: "0.00", isAllergene: false }); carica(); }
  };

  const filtrati = ingredienti.filter((i) => i.nome.toLowerCase().includes(search.toLowerCase()));

  const startEdit = (ing: any) => {
    setEditingId(ing.id);
    setEditForm({ nome: ing.nome, prezzoAggiunta: ing.prezzoAggiunta?.toString() ?? "0.00", isAllergene: ing.isAllergene });
  };

  return (
    <div className="animate-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <span style={{ position: "absolute", left: 12, top: 9, color: "var(--text-faint)", fontSize: 13 }}>⌕</span>
          <input
            style={{ width: "100%", background: "#fff", border: "1px solid var(--border)", color: "var(--text)", padding: "9px 12px 9px 34px", borderRadius: 9, fontSize: 12.5, outline: "none", fontFamily: "var(--font-ui)" }}
            placeholder="Cerca ingrediente…" value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{filtrati.length} ingredienti</span>
          {isSuperAdmin && (
            <button onClick={() => setShowNuovo(true)} style={{ background: "var(--text)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
              Nuovo ingrediente
            </button>
          )}
        </div>
      </div>

      <div style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)", borderRadius: 9, padding: "10px 16px", marginBottom: 16, fontSize: 12.5, color: "var(--accent-ink)" }}>
        {isSuperAdmin
          ? "Il prezzo di aggiunta viene applicato automaticamente quando un cliente aggiunge l'ingrediente extra a una pizza."
          : "Puoi segnare un ingrediente come esaurito — verrà disabilitato solo per la tua sede. I prezzi sono gestiti dall'admin."}
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)" }}>
              {["Ingrediente", "Prezzo aggiunta", "Allergene", ...(!isSuperAdmin ? ["Disponibile in sede"] : ["Azioni"])].map((h) => (
                <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrati.map((ing) => (
              <tr key={ing.id} style={{ borderTop: "1px solid var(--border-soft)", opacity: ing.disabilitatoInSede ? 0.6 : 1 }}>
                <td style={{ padding: "12px 14px" }}>
                  {editingId === ing.id ? (
                    <input style={editInputSt} value={editForm.nome} onChange={(e) => setEditForm((p) => ({ ...p, nome: e.target.value }))} />
                  ) : (
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>
                      {ing.nome}
                      {ing.disabilitatoInSede && (
                        <span style={{ marginLeft: 8, fontSize: 10, background: "var(--danger-bg)", color: "var(--danger)", padding: "2px 7px", borderRadius: 20 }}>esaurito</span>
                      )}
                    </span>
                  )}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  {editingId === ing.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}>€</span>
                      <input style={{ ...editInputSt, width: 80 }} type="number" step="0.10" min="0" value={editForm.prezzoAggiunta} onChange={(e) => setEditForm((p) => ({ ...p, prezzoAggiunta: e.target.value }))} />
                    </div>
                  ) : (
                    <span className="num" style={{ fontSize: 13, color: parseFloat(ing.prezzoAggiunta) > 0 ? "var(--text)" : "var(--text-muted)" }}>
                      {parseFloat(ing.prezzoAggiunta) > 0 ? `+ ${euro(parseFloat(ing.prezzoAggiunta))}` : "incluso"}
                    </span>
                  )}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  {editingId === ing.id ? (
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, color: "var(--text-2)" }}>
                      <input type="checkbox" checked={editForm.isAllergene} onChange={(e) => setEditForm((p) => ({ ...p, isAllergene: e.target.checked }))} />
                      Sì
                    </label>
                  ) : ing.isAllergene ? (
                    <span style={{ fontSize: 11, fontWeight: 500, background: "var(--danger-bg)", color: "var(--danger)", padding: "3px 10px", borderRadius: 20 }}>Sì</span>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--text-faint)" }}>—</span>
                  )}
                </td>

                {!isSuperAdmin && (
                  <td style={{ padding: "12px 14px" }}>
                    <button onClick={() => toggleDisabilitatoSede(ing)} style={{
                      padding: "5px 13px", borderRadius: 20, fontSize: 11.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)",
                      border: `1px solid ${ing.disabilitatoInSede ? "var(--danger-border)" : "var(--accent-border)"}`,
                      background: ing.disabilitatoInSede ? "var(--danger-bg)" : "var(--accent-bg-2)",
                      color: ing.disabilitatoInSede ? "var(--danger)" : "var(--accent-ink)",
                    }}>{ing.disabilitatoInSede ? "Esaurito" : "Disponibile"}</button>
                  </td>
                )}

                {isSuperAdmin && (
                  <td style={{ padding: "12px 14px" }}>
                    {editingId === ing.id ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => salvaPrezzoAdmin(ing.id)} style={{ background: "var(--accent-bg-2)", border: "1px solid var(--accent-border)", color: "var(--accent-ink)", padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)" }}>Salva</button>
                        <button onClick={() => setEditingId(null)} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text-3)", padding: "5px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)" }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(ing)} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)", padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)" }}>Modifica</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNuovo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowNuovo(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 26, width: 400, maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text)", marginBottom: 18 }}>Nuovo ingrediente</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={labelSt}>Nome *</label>
              <input style={fieldSt} placeholder="es. Nduja" value={nuovoForm.nome} onChange={(e) => setNuovoForm((p) => ({ ...p, nome: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelSt}>Prezzo aggiunta (€)</label>
              <input style={fieldSt} type="number" step="0.10" min="0" value={nuovoForm.prezzoAggiunta} onChange={(e) => setNuovoForm((p) => ({ ...p, prezzoAggiunta: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5, color: "var(--text-2)" }}>
                <input type="checkbox" checked={nuovoForm.isAllergene} onChange={(e) => setNuovoForm((p) => ({ ...p, isAllergene: e.target.checked }))} />
                È un allergene
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowNuovo(false)} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)", padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5 }}>Annulla</button>
              <button onClick={aggiungiIngrediente} style={{ background: "var(--text)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)" }}>Aggiungi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const fieldSt: React.CSSProperties = {
  width: "100%", background: "var(--surface-muted)", border: "1px solid var(--border)",
  color: "var(--text)", padding: "9px 12px", borderRadius: 9, fontSize: 12.5, outline: "none", fontFamily: "var(--font-ui)",
};
const labelSt: React.CSSProperties = {
  display: "block", fontSize: 10, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1.6,
};
const editInputSt: React.CSSProperties = {
  background: "#fff", border: "1px solid var(--border)", color: "var(--text)",
  padding: "6px 10px", borderRadius: 7, fontSize: 12.5, outline: "none", fontFamily: "var(--font-ui)",
};
