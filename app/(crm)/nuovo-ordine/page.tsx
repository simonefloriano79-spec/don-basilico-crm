"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { stampaBrowser } from "@/lib/print";

const CAT_LABEL: Record<string, string> = {
  pizze_rosse: "Pizze rosse", pizze_bianche: "Pizze bianche", calzoni: "Calzoni",
  fritti: "Fritti", bevande: "Bevande", dolci: "Dolci", extra: "Extra",
};

const fieldSt: React.CSSProperties = {
  width: "100%", background: "var(--surface-muted)", border: "1px solid var(--border)",
  color: "var(--text)", padding: "9px 12px", borderRadius: 9, fontSize: 12.5,
  outline: "none", fontFamily: "var(--font-ui)",
};

function euro(n: number) {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

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
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.55)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={onChiudi}>
      <div style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", margin: "0 auto", width: "100%", maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}>

        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)" }} />
        </div>

        <div style={{ padding: "12px 20px 14px", borderBottom: "1px solid var(--border-soft)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text)" }}>{item.nome}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{item.descrizione}</div>
            </div>
            <button onClick={onChiudi} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text-3)", width: 32, height: 32, borderRadius: "50%", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>✕</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {baseIngs.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.7, marginBottom: 8, fontWeight: 500 }}>
                Tocca per rimuovere
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {baseIngs.map((ing) => {
                  const removed = rimossi.has(ing.id);
                  return (
                    <button key={ing.id} onClick={() => {
                      const n = new Set(rimossi); n.has(ing.id) ? n.delete(ing.id) : n.add(ing.id); setRimossi(n);
                    }} style={{
                      padding: "6px 13px", borderRadius: 20, fontSize: 12.5, border: "1px solid", cursor: "pointer",
                      background: removed ? "var(--danger-bg)" : "var(--accent-bg)",
                      borderColor: removed ? "var(--danger-border)" : "var(--accent-border)",
                      color: removed ? "var(--danger)" : "var(--accent-ink)",
                      textDecoration: removed ? "line-through" : "none",
                    }}>{ing.nome}</button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.7, marginBottom: 8, fontWeight: 500 }}>
              Aggiungi extra
            </div>
            <div style={{ position: "relative", marginBottom: 10 }}>
              <span style={{ position: "absolute", left: 12, top: 10, color: "var(--text-faint)", fontSize: 13 }}>⌕</span>
              <input
                style={{ ...fieldSt, paddingLeft: 34, background: "#fff" }}
                placeholder="Cerca ingrediente…"
                value={search} onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {extra.map((ing) => {
                const added = aggiunti.has(ing.id);
                const prezzo = parseFloat(ing.prezzoAggiunta?.toString() ?? "0");
                return (
                  <button key={ing.id} onClick={() => {
                    const n = new Map(aggiunti); n.has(ing.id) ? n.delete(ing.id) : n.set(ing.id, ing); setAggiunti(n);
                  }} style={{
                    padding: "6px 13px", borderRadius: 20, fontSize: 12.5, border: "1px solid", cursor: "pointer",
                    background: added ? "var(--accent-bg)" : "var(--surface-muted)",
                    borderColor: added ? "var(--accent-border)" : "var(--border)",
                    color: added ? "var(--accent-ink)" : "var(--text-3)",
                  }}>
                    {ing.nome}
                    {prezzo > 0 && <span className="num" style={{ fontSize: 11.5, marginLeft: 5 }}>+{euro(prezzo)}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <input style={fieldSt}
            placeholder="Note (es. ben cotta, senza sale…)" value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border-soft)", background: "var(--surface-muted)", paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", color: "var(--text)", fontSize: 16, cursor: "pointer" }}>−</button>
              <span className="num" style={{ fontSize: 15, fontWeight: 500, minWidth: 20, textAlign: "center" }}>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", color: "var(--text)", fontSize: 16, cursor: "pointer" }}>+</button>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text)" }}>{euro(totale)}</div>
              {prezzoExtra > 0 && <div className="num" style={{ fontSize: 11, color: "var(--text-muted)" }}>+{euro(prezzoExtra)} extra</div>}
            </div>
          </div>
          <button onClick={conferma} style={{ width: "100%", background: "var(--text)", color: "#fff", border: "none", padding: 14, borderRadius: 9, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
            Aggiungi al carrello
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Contenuto carrello (condiviso desktop/mobile) ──────────────
function CartContents({ cart, setCart, canale, setCanale, tipo, setTipo, clienteNome, setClienteNome, clienteTel, setClienteTel, clienteIndirizzo, setClienteIndirizzo, note, setNote, onConferma, loading, justSent }: any) {
  const totale = cart.reduce((a: number, c: CartItem) => a + c.prezzoTotaleItem * c.qty, 0);
  return (
    <>
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10, borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {(["walk_in", "telefono"] as const).map((c) => (
            <button key={c} onClick={() => setCanale(c)} style={{
              flex: 1, padding: "9px", borderRadius: 9, border: "1px solid",
              fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)",
              background: canale === c ? "var(--text)" : "#fff",
              borderColor: canale === c ? "var(--text)" : "var(--border)",
              color: canale === c ? "#fff" : "var(--text-3)",
            }}>{c === "walk_in" ? "Walk-in" : "Telefono"}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["asporto", "domicilio", "tavolo"] as const).map((t) => (
            <button key={t} onClick={() => setTipo(t)} style={{
              flex: 1, padding: "7px", borderRadius: 8, border: "1px solid",
              fontSize: 11.5, cursor: "pointer", fontFamily: "var(--font-ui)", textTransform: "capitalize",
              background: tipo === t ? "var(--accent-bg-2)" : "transparent",
              borderColor: tipo === t ? "var(--accent-border)" : "var(--border)",
              color: tipo === t ? "var(--text)" : "var(--text-3)",
            }}>{t}</button>
          ))}
        </div>
        <input style={fieldSt} placeholder="Nome cliente" value={clienteNome} onChange={(e: any) => setClienteNome(e.target.value)} />
        <input style={fieldSt} placeholder="Telefono" value={clienteTel} onChange={(e: any) => setClienteTel(e.target.value)} />
        {tipo === "domicilio" && <input style={fieldSt} placeholder="Indirizzo *" value={clienteIndirizzo} onChange={(e: any) => setClienteIndirizzo(e.target.value)} />}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
        {cart.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 0", color: "var(--text-faint)", fontSize: 13 }}>
            Tocca una pizza dal menù per iniziare l'ordine
          </div>
        ) : cart.map((item: CartItem) => (
          <div key={item.cartId} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{item.nome}</div>
                <div className="num" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{euro(item.prezzoTotaleItem)} cad.</div>
                {item.ingredientiRimossi.length > 0 && <div style={{ fontSize: 11, color: "var(--danger)" }}>Senza: {item.ingredientiRimossi.map((i) => i.nome).join(", ")}</div>}
                {item.ingredientiAggiunti.length > 0 && <div style={{ fontSize: 11, color: "var(--accent-ink)" }}>Con: {item.ingredientiAggiunti.map((i) => i.nome).join(", ")}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <button onClick={() => setCart((p: CartItem[]) => { const ex = p.find((c) => c.cartId === item.cartId); if (!ex) return p; return ex.qty === 1 ? p.filter((c) => c.cartId !== item.cartId) : p.map((c) => c.cartId === item.cartId ? { ...c, qty: c.qty - 1 } : c); })}
                  style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)", background: "#fff", color: "var(--text)", fontSize: 14, cursor: "pointer" }}>−</button>
                <span className="num" style={{ fontSize: 13, minWidth: 16, textAlign: "center" }}>{item.qty}</span>
                <button onClick={() => setCart((p: CartItem[]) => p.map((c) => c.cartId === item.cartId ? { ...c, qty: c.qty + 1 } : c))}
                  style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)", background: "#fff", color: "var(--text)", fontSize: 14, cursor: "pointer" }}>+</button>
              </div>
              <span className="num" style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", minWidth: 56, textAlign: "right", flexShrink: 0 }}>{euro(item.prezzoTotaleItem * item.qty)}</span>
            </div>
          </div>
        ))}
        {cart.length > 0 && (
          <textarea style={{ ...fieldSt, resize: "none", marginTop: 4 } as any} rows={2} placeholder="Note ordine…" value={note} onChange={(e: any) => setNote(e.target.value)} />
        )}
      </div>

      <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border-soft)", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Consegna incl.</span>
          <span className="num" style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--text)" }}>{euro(totale)}</span>
        </div>
        <button onClick={onConferma} disabled={loading || cart.length === 0} style={{
          width: "100%", border: "none", padding: 14, borderRadius: 9, fontSize: 13, fontWeight: 500,
          cursor: cart.length === 0 ? "default" : "pointer", fontFamily: "var(--font-ui)",
          background: justSent ? "var(--accent)" : cart.length === 0 ? "var(--border)" : "var(--text)",
          color: cart.length === 0 ? "var(--text-faint)" : "#fff",
        }}>
          {loading ? "Invio…" : justSent ? "✓ Ordine inviato in cucina" : "Invia in cucina"}
        </button>
      </div>
    </>
  );
}

// ── Pagina principale ────────────────────────────────────────
export default function NuovoOrdinePage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";

  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [ingredienti, setIngredienti] = useState<Ingrediente[]>([]);
  const [sedi, setSedi] = useState<any[]>([]);
  const [sedeSelezionata, setSede] = useState(user?.sedeId ?? "");
  const [catFiltro, setCatFiltro] = useState("pizze_rosse");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [canale, setCanale] = useState<"walk_in" | "telefono">("walk_in");
  const [tipo, setTipo] = useState<"asporto" | "domicilio" | "tavolo">("asporto");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTel, setClienteTel] = useState("");
  const [clienteIndirizzo, setAddr] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [pizzaModal, setPizzaModal] = useState<any>(null);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    fetch("/api/sedi").then((r) => r.json()).then((d) => {
      setSedi(Array.isArray(d) ? d : []);
      if (!sedeSelezionata && d.length > 0) setSede(d[0].id);
    });
  }, []);

  useEffect(() => {
    if (!sedeSelezionata) return;
    fetch(`/api/menu?sedeId=${sedeSelezionata}`).then((r) => r.json()).then((d) =>
      setMenuItems((d.items ?? []).filter((i: any) => i.isAttivo)));
    fetch(`/api/ingredienti?sedeId=${sedeSelezionata}`).then((r) => r.json()).then((d) =>
      setIngredienti(Array.isArray(d) ? d : []));
  }, [sedeSelezionata]);

  const cats = ["pizze_rosse", "pizze_bianche", "calzoni", "fritti", "bevande", "dolci", "extra"];
  const catsPresenti = cats.filter((c) => menuItems.some((m) => m.categoria === c));
  const itemsFiltrati = menuItems.filter((m) => m.categoria === catFiltro);
  const cartQty = cart.reduce((a, c) => a + c.qty, 0);
  const totale = cart.reduce((a, c) => a + c.prezzoTotaleItem * c.qty, 0);
  const nomeSede = sedi.find((s) => s.id === sedeSelezionata)?.nome ?? "";

  const handleClick = (item: any) => {
    if (item.disponibileInSede === false) return;
    const isPizza = ["pizze_rosse", "pizze_bianche", "calzoni"].includes(item.categoria);
    if (isPizza) { setPizzaModal(item); return; }
    const prezzo = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
    setCart((prev) => {
      const ex = prev.find((c) => c.menuItemId === item.id && !c.ingredientiAggiunti.length && !c.ingredientiRimossi.length);
      if (ex) return prev.map((c) => c.cartId === ex.cartId ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { cartId: crypto.randomUUID(), menuItemId: item.id, nome: item.nome, prezzoBase: prezzo, qty: 1, ingredientiRimossi: [], ingredientiAggiunti: [], noteItem: "", prezzoTotaleItem: prezzo }];
    });
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
          nomeSnapshot: c.nome + (c.ingredientiAggiunti.length ? ` +${c.ingredientiAggiunti.map((i) => i.nome).join("+")}` : "") + (c.ingredientiRimossi.length ? ` -${c.ingredientiRimossi.map((i) => i.nome).join("-")}` : ""),
          quantita: c.qty,
          noteItem: [c.ingredientiRimossi.length ? `Senza: ${c.ingredientiRimossi.map((i) => i.nome).join(", ")}` : "", c.ingredientiAggiunti.length ? `Con: ${c.ingredientiAggiunti.map((i) => i.nome).join(", ")}` : "", c.noteItem].filter(Boolean).join(" | ") || null,
          ingredientiRimossi: c.ingredientiRimossi.map((i) => i.id),
          ingredientiAggiuntiIds: c.ingredientiAggiunti.map((i) => i.id),
        })),
      }),
    });
    setLoading(false);
    if (res.ok) {
      const ordine = await res.json();
      toast.success(`Ordine #${ordine.numeroOrdine} creato`);
      stampaBrowser({ numero: ordine.numeroOrdine, sede: nomeSede, canale, tipo, cliente: clienteNome || "Cliente anonimo", telefono: clienteTel, indirizzo: clienteIndirizzo, items: cart.map((c) => ({ nome: c.nome, qty: c.qty, prezzo: c.prezzoTotaleItem })), totale, note, ora: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) });
      setJustSent(true);
      setTimeout(() => setJustSent(false), 1800);
      setCart([]); setClienteNome(""); setClienteTel(""); setAddr(""); setNote(""); setShowCart(false);
    } else { toast.error("Errore nella creazione dell'ordine"); }
  };

  const cartProps = { cart, setCart, canale, setCanale, tipo, setTipo, clienteNome, setClienteNome, clienteTel, setClienteTel, clienteIndirizzo, setClienteIndirizzo: setAddr, note, setNote, onConferma: confermaOrdine, loading, justSent };

  return (
    <div className="animate-in" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {isSuperAdmin && (
          <select value={sedeSelezionata} onChange={(e) => setSede(e.target.value)} style={{ ...fieldSt, background: "#fff", marginBottom: 12, width: 260 }}>
            {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        )}

        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
          {catsPresenti.map((c) => (
            <button key={c} onClick={() => setCatFiltro(c)} style={{
              flexShrink: 0, padding: "8px 15px", borderRadius: 20, fontSize: 12.5, cursor: "pointer",
              border: "1px solid", fontFamily: "var(--font-ui)", whiteSpace: "nowrap",
              background: catFiltro === c ? "var(--text)" : "#fff",
              borderColor: catFiltro === c ? "var(--text)" : "var(--border)",
              color: catFiltro === c ? "#fff" : "var(--text-3)",
            }}>{CAT_LABEL[c] ?? c}</button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
          {itemsFiltrati.map((item) => {
            const prezzo = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
            const nInCart = cart.filter((c) => c.menuItemId === item.id).reduce((a, c) => a + c.qty, 0);
            const esaurito = item.disponibileInSede === false;
            return (
              <div key={item.id} onClick={() => handleClick(item)} style={{
                background: "#fff", border: `1px solid ${nInCart > 0 ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 12, padding: 14, cursor: esaurito ? "default" : "pointer", position: "relative",
                userSelect: "none", opacity: esaurito ? 0.55 : 1,
              }}>
                {nInCart > 0 && (
                  <div className="num" style={{ position: "absolute", top: 10, right: 10, background: "var(--text)", color: "#fff", width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500 }}>{nInCart}</div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text)" }}>{item.nome}</span>
                  <span className="num" style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", flexShrink: 0 }}>{euro(prezzo)}</span>
                </div>
                {item.descrizione && <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.45, marginTop: 6 }}>{item.descrizione}</div>}
                {esaurito && <div style={{ fontSize: 10.5, color: "var(--danger)", marginTop: 6 }}>Esaurito in sede</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Carrello desktop */}
      <div className="cart-desktop" style={{
        width: 352, flexShrink: 0, position: "sticky", top: 0,
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
        display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 52px)",
      }}>
        <CartContents {...cartProps} />
      </div>

      {/* FAB carrello mobile */}
      <div className="cart-mobile-fab" style={{ display: "none", position: "fixed", bottom: 80, left: 16, right: 16, zIndex: 100 }}>
        {cartQty > 0 && (
          <button onClick={() => setShowCart(true)} style={{
            width: "100%", background: "var(--text)", color: "#fff", border: "none",
            padding: "14px 18px", borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: "pointer",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>{cartQty} {cartQty === 1 ? "prodotto" : "prodotti"}</span>
            <span className="num" style={{ fontSize: 15 }}>{euro(totale)} →</span>
          </button>
        )}
      </div>

      {pizzaModal && (
        <PizzaModal item={pizzaModal} tuttiIngredienti={ingredienti}
          onConferma={(c) => { setCart((p) => [...p, c]); setPizzaModal(null); toast.success(`${c.nome} aggiunto`, { duration: 1000 }); }}
          onChiudi={() => setPizzaModal(null)} />
      )}
      {showCart && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.55)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
          onClick={() => setShowCart(false)}>
          <div style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)" }} />
            </div>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)" }}>Carrello ({cart.length})</span>
              <button onClick={() => setShowCart(false)} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text-3)", width: 30, height: 30, borderRadius: "50%", fontSize: 13, cursor: "pointer" }}>✕</button>
            </div>
            <CartContents {...cartProps} />
          </div>
        </div>
      )}
    </div>
  );
}
