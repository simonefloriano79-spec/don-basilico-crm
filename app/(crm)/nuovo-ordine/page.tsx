"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { stampaBrowser } from "@/lib/print";

const CAT_COLOR: Record<string, string> = {
  pizze_rosse: "#c85a2e", pizze_bianche: "#d4a853", calzoni: "#9b7ecb",
  fritti: "#4a7ec8", bevande: "#4a9e6b", dolci: "#e87e8a", extra: "#8a7a65",
};
const CAT_LABEL: Record<string, string> = {
  pizze_rosse: "🍅 Rosse", pizze_bianche: "🧀 Bianche", calzoni: "🫓 Calzoni",
  fritti: "🍟 Fritti", bevande: "🥤 Bevande", dolci: "🍫 Dolci", extra: "➕ Extra",
};

interface Ingrediente {
  id: string; nome: string; prezzoAggiunta: number;
  isAllergene: boolean; disabilitatoInSede?: boolean;
}
interface CartItem {
  cartId: string; menuItemId: string; nome: string; prezzoBase: number; qty: number;
  ingredientiRimossi: { id: string; nome: string }[];
  ingredientiAggiunti: { id: string; nome: string; prezzo: number }[];
  noteItem: string; prezzoTotaleItem: number;
}

// ── Modale configurazione pizza ───────────────────────────────
function PizzaModal({ item, tuttiIngredienti, onConferma, onChiudi }: {
  item: any; tuttiIngredienti: Ingrediente[];
  onConferma: (c: CartItem) => void; onChiudi: () => void;
}) {
  const baseIngs: Ingrediente[] = (item.ingredienti ?? []).map((ii: any) => ii.ingrediente ?? ii);
  const baseIds = new Set(baseIngs.map((i) => i.id));
  const [rimossi, setRimossi] = useState<Set<string>>(new Set());
  const [aggiunti, setAggiunti] = useState<Map<string, Ingrediente>>(new Map());
  const [nota, setNota] = useState("");
  const [qty, setQty] = useState(1);
  const [search, setSearch] = useState("");

  const extra = tuttiIngredienti.filter((i) => !baseIds.has(i.id) && !i.disabilitatoInSede
    && i.nome.toLowerCase().includes(search.toLowerCase()));
  const prezzoBase = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
  const prezzoExtra = Array.from(aggiunti.values()).reduce((a, i) => a + parseFloat(i.prezzoAggiunta?.toString() ?? "0"), 0);
  const totale = (prezzoBase + prezzoExtra) * qty;

  const conferma = () => {
    onConferma({
      cartId: crypto.randomUUID(), menuItemId: item.id, nome: item.nome,
      prezzoBase, qty,
      ingredientiRimossi: baseIngs.filter((i) => rimossi.has(i.id)).map((i) => ({ id: i.id, nome: i.nome })),
      ingredientiAggiunti: Array.from(aggiunti.values()).map((i) => ({ id: i.id, nome: i.nome, prezzo: parseFloat(i.prezzoAggiunta?.toString() ?? "0") })),
      noteItem: nota, prezzoTotaleItem: prezzoBase + prezzoExtra,
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={onChiudi}>
      <div style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Handle bar */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)" }} />
        </div>

        {/* Header */}
        <div style={{ padding: "12px 20px 10px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700, color: "var(--cream)" }}>{item.nome}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{item.descrizione}</div>
            </div>
            <button onClick={onChiudi} style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text-dim)", width: 32, height: 32, borderRadius: "50%", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

          {/* Ingredienti base */}
          {baseIngs.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>
                Tocca per rimuovere
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {baseIngs.map((ing) => {
                  const removed = rimossi.has(ing.id);
                  return (
                    <button key={ing.id} onClick={() => {
                      const n = new Set(rimossi); n.has(ing.id) ? n.delete(ing.id) : n.add(ing.id); setRimossi(n);
                    }} style={{
                      padding: "7px 14px", borderRadius: 20, fontSize: 14, border: "1px solid",
                      background: removed ? "rgba(200,64,64,0.15)" : "rgba(74,158,107,0.15)",
                      borderColor: removed ? "#c84040" : "#4a9e6b",
                      color: removed ? "#c84040" : "#4a9e6b",
                      textDecoration: removed ? "line-through" : "none",
                    }}>{removed ? "✗ " : "✓ "}{ing.nome}</button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Extra */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>
              Aggiungi extra
            </div>
            <input
              style={{ width: "100%", background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "10px 14px", borderRadius: 10, fontSize: 14, outline: "none", marginBottom: 10 }}
              placeholder="🔍 Cerca ingrediente..."
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {extra.map((ing) => {
                const added = aggiunti.has(ing.id);
                const prezzo = parseFloat(ing.prezzoAggiunta?.toString() ?? "0");
                return (
                  <button key={ing.id} onClick={() => {
                    const n = new Map(aggiunti); n.has(ing.id) ? n.delete(ing.id) : n.set(ing.id, ing); setAggiunti(n);
                  }} style={{
                    padding: "7px 14px", borderRadius: 20, fontSize: 14, border: "1px solid",
                    background: added ? "rgba(200,90,46,0.2)" : "var(--surface-high)",
                    borderColor: added ? "var(--terracotta)" : "var(--border)",
                    color: added ? "var(--terracotta)" : "var(--text-dim)",
                  }}>
                    {added ? "✓ " : "+ "}{ing.nome}
                    {prezzo > 0 && <span style={{ fontSize: 12, marginLeft: 4, fontFamily: "var(--font-mono)" }}>+€{prezzo.toFixed(2)}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <input style={{ width: "100%", background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "10px 14px", borderRadius: 10, fontSize: 14, outline: "none" }}
            placeholder="Note (es. ben cotta, senza sale...)" value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>

        {/* Footer fisso */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", background: "var(--surface-high)", paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 20 }}>−</button>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, minWidth: 24, textAlign: "center" }}>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 20 }}>+</button>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: "#d4a853" }}>€{totale.toFixed(2)}</div>
              {prezzoExtra > 0 && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>+€{prezzoExtra.toFixed(2)} extra</div>}
            </div>
          </div>
          <button onClick={conferma} style={{ width: "100%", background: "var(--terracotta)", color: "white", border: "none", padding: 16, borderRadius: 12, fontSize: 16, fontWeight: 700 }}>
            ✓ Aggiungi al carrello
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modale carrello (mobile) ──────────────────────────────────
function CartDrawer({ cart, setCart, canale, setCanale, tipo, setTipo, clienteNome, setClienteNome, clienteTel, setClienteTel, clienteIndirizzo, setClienteIndirizzo, note, setNote, onConferma, loading, onChiudi }: any) {
  const totale = cart.reduce((a: number, c: CartItem) => a + c.prezzoTotaleItem * c.qty, 0);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={onChiudi}>
      <div style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)" }} />
        </div>
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 700, color: "var(--cream)" }}>🛒 Carrello ({cart.length})</span>
          <button onClick={onChiudi} style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text-dim)", width: 32, height: 32, borderRadius: "50%", fontSize: 16 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
          {/* Canale */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {(["walk_in","telefono"] as const).map((c) => (
              <button key={c} onClick={() => setCanale(c)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid", fontSize: 14, background: canale === c ? "rgba(200,90,46,0.15)" : "var(--surface-high)", borderColor: canale === c ? "var(--terracotta)" : "var(--border)", color: canale === c ? "var(--terracotta)" : "var(--text-dim)" }}>
                {c === "walk_in" ? "🚶 Walk-in" : "📞 Telefono"}
              </button>
            ))}
          </div>
          {/* Tipo */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {(["asporto","domicilio","tavolo"] as const).map((t) => (
              <button key={t} onClick={() => setTipo(t)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid", fontSize: 13, background: tipo === t ? "rgba(200,90,46,0.15)" : "transparent", borderColor: tipo === t ? "var(--terracotta)" : "var(--border)", color: tipo === t ? "var(--terracotta)" : "var(--text-dim)" }}>{t}</button>
            ))}
          </div>
          {/* Cliente */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            <input style={inpSt} placeholder="Nome cliente" value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
            <input style={inpSt} placeholder="Telefono" value={clienteTel} onChange={(e) => setClienteTel(e.target.value)} />
            {tipo === "domicilio" && <input style={inpSt} placeholder="Indirizzo *" value={clienteIndirizzo} onChange={(e) => setClienteIndirizzo(e.target.value)} />}
          </div>
          {/* Items */}
          {cart.map((item: CartItem) => (
            <div key={item.cartId} style={{ background: "var(--surface-high)", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{item.nome}</div>
                  {item.ingredientiRimossi.length > 0 && <div style={{ fontSize: 11, color: "#c84040" }}>✗ Senza: {item.ingredientiRimossi.map(i=>i.nome).join(", ")}</div>}
                  {item.ingredientiAggiunti.length > 0 && <div style={{ fontSize: 11, color: "var(--terracotta)" }}>+ {item.ingredientiAggiunti.map(i=>i.nome).join(", ")}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setCart((p: CartItem[]) => { const ex = p.find(c=>c.cartId===item.cartId); if(!ex) return p; return ex.qty===1 ? p.filter(c=>c.cartId!==item.cartId) : p.map(c=>c.cartId===item.cartId?{...c,qty:c.qty-1}:c); })}
                    style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 16 }}>−</button>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, minWidth: 16, textAlign: "center" }}>{item.qty}</span>
                  <button onClick={() => setCart((p: CartItem[]) => p.map(c=>c.cartId===item.cartId?{...c,qty:c.qty+1}:c))}
                    style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 16 }}>+</button>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "#d4a853", minWidth: 56, textAlign: "right" }}>€{(item.prezzoTotaleItem*item.qty).toFixed(2)}</span>
              </div>
            </div>
          ))}
          <textarea style={{ ...inpSt, resize: "none" } as any} rows={2} placeholder="Note ordine..." value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 16, color: "var(--text-dim)" }}>Totale</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 700, color: "#d4a853" }}>€{totale.toFixed(2)}</span>
          </div>
          <button onClick={onConferma} disabled={loading || cart.length === 0} style={{ width: "100%", background: cart.length === 0 ? "var(--border)" : "var(--terracotta)", color: "white", border: "none", padding: 16, borderRadius: 12, fontSize: 16, fontWeight: 700, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Invio..." : "✅ Conferma + Stampa"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pagina principale ────────────────────────────────────────
export default function NuovoOrdinePage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";

  const [menuItems, setMenuItems]     = useState<any[]>([]);
  const [ingredienti, setIngredienti] = useState<Ingrediente[]>([]);
  const [sedi, setSedi]               = useState<any[]>([]);
  const [sedeSelezionata, setSede]    = useState(user?.sedeId ?? "");
  const [catFiltro, setCatFiltro]     = useState("pizze_rosse");
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [canale, setCanale]           = useState<"walk_in"|"telefono">("walk_in");
  const [tipo, setTipo]               = useState<"asporto"|"domicilio"|"tavolo">("asporto");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTel, setClienteTel]   = useState("");
  const [clienteIndirizzo, setAddr]   = useState("");
  const [note, setNote]               = useState("");
  const [loading, setLoading]         = useState(false);
  const [pizzaModal, setPizzaModal]   = useState<any>(null);
  const [showCart, setShowCart]       = useState(false);

  useEffect(() => {
    fetch("/api/sedi").then(r=>r.json()).then((d) => {
      setSedi(Array.isArray(d) ? d : []);
      if (!sedeSelezionata && d.length > 0) setSede(d[0].id);
    });
  }, []);

  useEffect(() => {
    if (!sedeSelezionata) return;
    fetch(`/api/menu?sedeId=${sedeSelezionata}`).then(r=>r.json()).then((d) =>
      setMenuItems((d.items ?? []).filter((i: any) => i.disponibileInSede !== false && i.isAttivo)));
    fetch(`/api/ingredienti?sedeId=${sedeSelezionata}`).then(r=>r.json()).then((d) =>
      setIngredienti(Array.isArray(d) ? d : []));
  }, [sedeSelezionata]);

  const cats = ["pizze_rosse","pizze_bianche","calzoni","fritti","bevande","dolci","extra"];
  const catsPresenti = cats.filter((c) => menuItems.some((m) => m.categoria === c));
  const itemsFiltrati = menuItems.filter((m) => m.categoria === catFiltro);
  const cartQty = cart.reduce((a,c)=>a+c.qty, 0);
  const totale = cart.reduce((a,c)=>a+c.prezzoTotaleItem*c.qty, 0);
  const nomeSede = sedi.find((s) => s.id === sedeSelezionata)?.nome ?? "";

  const handleClick = (item: any) => {
    const isPizza = ["pizze_rosse","pizze_bianche","calzoni"].includes(item.categoria);
    if (isPizza) { setPizzaModal(item); return; }
    const prezzo = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
    setCart((prev) => {
      const ex = prev.find((c) => c.menuItemId === item.id && !c.ingredientiAggiunti.length && !c.ingredientiRimossi.length);
      if (ex) return prev.map((c) => c.cartId === ex.cartId ? {...c, qty: c.qty+1} : c);
      return [...prev, { cartId: crypto.randomUUID(), menuItemId: item.id, nome: item.nome, prezzoBase: prezzo, qty: 1, ingredientiRimossi: [], ingredientiAggiunti: [], noteItem: "", prezzoTotaleItem: prezzo }];
    });
    toast.success(`${item.nome} aggiunto!`, { duration: 800 });
  };

  const confermaOrdine = async () => {
    if (!cart.length) return toast.error("Aggiungi almeno un prodotto");
    setLoading(true);
    const res = await fetch("/api/ordini", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sedeId: sedeSelezionata, canale, tipo,
        clienteNome: clienteNome || "Cliente anonimo",
        clienteTelefono: clienteTel || null,
        clienteIndirizzo: tipo === "domicilio" ? clienteIndirizzo : null,
        note: note || null,
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          nomeSnapshot: c.nome + (c.ingredientiAggiunti.length ? ` +${c.ingredientiAggiunti.map(i=>i.nome).join("+")}` : "") + (c.ingredientiRimossi.length ? ` -${c.ingredientiRimossi.map(i=>i.nome).join("-")}` : ""),
          quantita: c.qty,
          noteItem: [c.ingredientiRimossi.length ? `Senza: ${c.ingredientiRimossi.map(i=>i.nome).join(", ")}` : "", c.ingredientiAggiunti.length ? `Con: ${c.ingredientiAggiunti.map(i=>i.nome).join(", ")}` : "", c.noteItem].filter(Boolean).join(" | ") || null,
          ingredientiRimossi: c.ingredientiRimossi.map(i=>i.id),
          ingredientiAggiuntiIds: c.ingredientiAggiunti.map(i=>i.id),
        })),
      }),
    });
    setLoading(false);
    if (res.ok) {
      const ordine = await res.json();
      toast.success(`Ordine #${ordine.numeroOrdine} creato! 🍕`);
      stampaBrowser({ numero: ordine.numeroOrdine, sede: nomeSede, canale, tipo, cliente: clienteNome||"Cliente anonimo", telefono: clienteTel, indirizzo: clienteIndirizzo, items: cart.map(c=>({nome:c.nome,qty:c.qty,prezzo:c.prezzoTotaleItem})), totale, note, ora: new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"}) });
      setCart([]); setClienteNome(""); setClienteTel(""); setAddr(""); setNote(""); setShowCart(false);
    } else { toast.error("Errore nella creazione dell'ordine"); }
  };

  return (
    <div className="animate-in" style={{ maxWidth: "100%", overflow: "hidden" }}>

      {/* Sede selector (admin) */}
      {isSuperAdmin && (
        <select value={sedeSelezionata} onChange={(e) => setSede(e.target.value)}
          style={{ width: "100%", background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "10px 12px", borderRadius: 10, fontSize: 14, marginBottom: 12 }}>
          {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      )}

      {/* Categorie — scrollabile orizzontalmente */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 12, WebkitOverflowScrolling: "touch" as any }}>
        {catsPresenti.map((c) => {
          const col = CAT_COLOR[c] ?? "var(--terracotta)";
          return (
            <button key={c} onClick={() => setCatFiltro(c)} style={{
              flexShrink: 0, padding: "8px 16px", borderRadius: 20, fontSize: 13, border: "1px solid",
              background: catFiltro === c ? `${col}20` : "transparent",
              borderColor: catFiltro === c ? col : "var(--border)",
              color: catFiltro === c ? col : "var(--text-dim)",
              fontWeight: catFiltro === c ? 700 : 400, whiteSpace: "nowrap",
            }}>{CAT_LABEL[c] ?? c}</button>
          );
        })}
      </div>

      {/* Griglia prodotti — responsive */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
        {itemsFiltrati.map((item) => {
          const prezzo = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
          const col = CAT_COLOR[item.categoria] ?? "var(--terracotta)";
          const isPizza = ["pizze_rosse","pizze_bianche","calzoni"].includes(item.categoria);
          const nInCart = cart.filter((c) => c.menuItemId === item.id).reduce((a,c)=>a+c.qty,0);
          return (
            <div key={item.id} onClick={() => handleClick(item)} style={{
              background: "var(--surface)", border: `1px solid ${nInCart > 0 ? col : "var(--border)"}`,
              borderRadius: 12, padding: "12px", cursor: "pointer", position: "relative", userSelect: "none",
            }}>
              {nInCart > 0 && (
                <div style={{ position: "absolute", top: 8, right: 8, background: col, color: "white", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{nInCart}</div>
              )}
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--cream)", marginBottom: 4 }}>{item.nome}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 600, color: "#d4a853" }}>€{prezzo.toFixed(2)}</span>
                {isPizza && <span style={{ fontSize: 10, color: col }}>⚙</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* FAB Carrello — fisso in basso */}
      {cartQty > 0 && (
        <div style={{ position: "fixed", bottom: 80, left: 16, right: 16, zIndex: 100 }}>
          <button onClick={() => setShowCart(true)} style={{
            width: "100%", background: "var(--terracotta)", color: "white", border: "none",
            padding: "16px 20px", borderRadius: 16, fontSize: 16, fontWeight: 700,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            boxShadow: "0 8px 32px rgba(200,90,46,0.4)",
          }}>
            <span>🛒 {cartQty} {cartQty === 1 ? "prodotto" : "prodotti"}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 18 }}>€{totale.toFixed(2)} →</span>
          </button>
        </div>
      )}

      {/* Modali */}
      {pizzaModal && (
        <PizzaModal item={pizzaModal} tuttiIngredienti={ingredienti}
          onConferma={(c) => { setCart(p=>[...p,c]); setPizzaModal(null); toast.success(`${c.nome} aggiunto! 🍕`, {duration:1000}); }}
          onChiudi={() => setPizzaModal(null)} />
      )}
      {showCart && (
        <CartDrawer cart={cart} setCart={setCart} canale={canale} setCanale={setCanale}
          tipo={tipo} setTipo={setTipo} clienteNome={clienteNome} setClienteNome={setClienteNome}
          clienteTel={clienteTel} setClienteTel={setClienteTel} clienteIndirizzo={clienteIndirizzo}
          setClienteIndirizzo={setAddr} note={note} setNote={setNote}
          onConferma={confermaOrdine} loading={loading} onChiudi={() => setShowCart(false)} />
      )}
    </div>
  );
}

const inpSt: React.CSSProperties = {
  width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
  color: "var(--text)", padding: "10px 14px", borderRadius: 10, fontSize: 14, outline: "none",
};
