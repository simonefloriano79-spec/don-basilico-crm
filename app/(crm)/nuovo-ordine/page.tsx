"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { stampaBrowser } from "@/lib/print";

// ── Colori categoria ──────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  pizze_rosse:   "#c85a2e",
  pizze_bianche: "#d4a853",
  calzoni:       "#9b7ecb",
  fritti:        "#4a7ec8",
  bevande:       "#4a9e6b",
  dolci:         "#e87e8a",
  extra:         "#8a7a65",
};

const CAT_LABEL: Record<string, string> = {
  pizze_rosse:   "🍅 Pizze Rosse",
  pizze_bianche: "🧀 Pizze Bianche",
  calzoni:       "🫓 Calzoni",
  fritti:        "🍟 Fritti",
  bevande:       "🥤 Bevande",
  dolci:         "🍫 Dolci",
  extra:         "➕ Extra",
};

// ── Tipi ─────────────────────────────────────────────────────
interface Ingrediente {
  id: string;
  nome: string;
  prezzoAggiunta: number;
  isAllergene: boolean;
  disabilitatoInSede?: boolean;
}

interface CartItem {
  cartId: string; // uuid locale per gestire duplicati
  menuItemId: string;
  nome: string;
  prezzoBase: number;
  qty: number;
  ingredientiRimossi: { id: string; nome: string }[];
  ingredientiAggiunti: { id: string; nome: string; prezzo: number }[];
  noteItem: string;
  prezzoTotaleItem: number; // prezzo base + extra
}

// ── Componente modale configurazione pizza ────────────────────
function PizzaConfigModal({
  item,
  tuttiIngredienti,
  sedeId,
  onConferma,
  onChiudi,
}: {
  item: any;
  tuttiIngredienti: Ingrediente[];
  sedeId: string;
  onConferma: (cartItem: CartItem) => void;
  onChiudi: () => void;
}) {
  const ingredientiBase: Ingrediente[] = (item.ingredienti ?? []).map(
    (ii: any) => ii.ingrediente ?? ii
  );
  const baseIds = new Set(ingredientiBase.map((i) => i.id));

  const [rimossi, setRimossi] = useState<Set<string>>(new Set());
  const [aggiunti, setAggiunti] = useState<Map<string, Ingrediente>>(new Map());
  const [nota, setNota] = useState("");
  const [qty, setQty] = useState(1);
  const [searchExtra, setSearchExtra] = useState("");

  const extraDisponibili = tuttiIngredienti.filter(
    (i) => !baseIds.has(i.id) && !i.disabilitatoInSede
  );

  const extraFiltrati = extraDisponibili.filter((i) =>
    i.nome.toLowerCase().includes(searchExtra.toLowerCase())
  );

  const prezzoBase = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
  const prezzoExtra = Array.from(aggiunti.values()).reduce(
    (acc, i) => acc + parseFloat(i.prezzoAggiunta?.toString() ?? "0"),
    0
  );
  const prezzoUnitario = prezzoBase + prezzoExtra;
  const prezzoTotale = prezzoUnitario * qty;

  const toggleRimuovi = (id: string) => {
    const n = new Set(rimossi);
    n.has(id) ? n.delete(id) : n.add(id);
    setRimossi(n);
  };

  const toggleAggiungi = (ing: Ingrediente) => {
    const n = new Map(aggiunti);
    n.has(ing.id) ? n.delete(ing.id) : n.set(ing.id, ing);
    setAggiunti(n);
  };

  const conferma = () => {
    const cartItem: CartItem = {
      cartId: crypto.randomUUID(),
      menuItemId: item.id,
      nome: item.nome,
      prezzoBase,
      qty,
      ingredientiRimossi: ingredientiBase
        .filter((i) => rimossi.has(i.id))
        .map((i) => ({ id: i.id, nome: i.nome })),
      ingredientiAggiunti: Array.from(aggiunti.values()).map((i) => ({
        id: i.id,
        nome: i.nome,
        prezzo: parseFloat(i.prezzoAggiunta?.toString() ?? "0"),
      })),
      noteItem: nota,
      prezzoTotaleItem: prezzoUnitario,
    };
    onConferma(cartItem);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)", padding: 16 }}
      onClick={onChiudi}
    >
      <div
        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface-high)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700, color: "var(--cream)" }}>{item.nome}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{item.descrizione}</div>
            </div>
            <button onClick={onChiudi} style={{ background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>✕</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          {/* INGREDIENTI BASE — rimuovi */}
          {ingredientiBase.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>
                Ingredienti inclusi — tocca per rimuovere
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ingredientiBase.map((ing) => {
                  const removed = rimossi.has(ing.id);
                  const esaurito = ing.disabilitatoInSede;
                  return (
                    <button
                      key={ing.id}
                      onClick={() => !esaurito && toggleRimuovi(ing.id)}
                      disabled={esaurito}
                      style={{
                        padding: "5px 12px", borderRadius: 20, fontSize: 13,
                        fontFamily: "var(--font-sans)", cursor: esaurito ? "not-allowed" : "pointer",
                        border: "1px solid", transition: "all 0.15s",
                        background: removed ? "rgba(200,64,64,0.15)" : esaurito ? "rgba(138,122,101,0.1)" : "rgba(74,158,107,0.15)",
                        borderColor: removed ? "#c84040" : esaurito ? "var(--border)" : "#4a9e6b",
                        color: removed ? "#c84040" : esaurito ? "var(--text-dim)" : "#4a9e6b",
                        textDecoration: removed ? "line-through" : "none",
                      }}
                    >
                      {removed ? "✗ " : "✓ "}{ing.nome}
                      {esaurito && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>esaurito</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* INGREDIENTI EXTRA — aggiungi */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>
              Aggiungi ingredienti extra
            </div>
            <input
              style={{ width: "100%", background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "var(--font-sans)", marginBottom: 10 }}
              placeholder="Cerca ingrediente... es. crudo, funghi, gorgonzola"
              value={searchExtra}
              onChange={(e) => setSearchExtra(e.target.value)}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {extraFiltrati.map((ing) => {
                const aggiunto = aggiunti.has(ing.id);
                const prezzo = parseFloat(ing.prezzoAggiunta?.toString() ?? "0");
                return (
                  <button
                    key={ing.id}
                    onClick={() => toggleAggiungi(ing)}
                    style={{
                      padding: "5px 12px", borderRadius: 20, fontSize: 13,
                      fontFamily: "var(--font-sans)", cursor: "pointer",
                      border: "1px solid", transition: "all 0.15s",
                      background: aggiunto ? "rgba(200,90,46,0.2)" : "var(--surface-high)",
                      borderColor: aggiunto ? "var(--terracotta)" : "var(--border)",
                      color: aggiunto ? "var(--terracotta)" : "var(--text-dim)",
                    }}
                  >
                    {aggiunto ? "✓ " : "+ "}{ing.nome}
                    {prezzo > 0 && (
                      <span style={{ marginLeft: 4, fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.8 }}>
                        +€{prezzo.toFixed(2)}
                      </span>
                    )}
                    {ing.isAllergene && <span style={{ marginLeft: 3, fontSize: 11 }}>⚠️</span>}
                  </button>
                );
              })}
              {extraFiltrati.length === 0 && searchExtra && (
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Nessun ingrediente trovato</span>
              )}
            </div>
          </div>

          {/* NOTE */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 600 }}>Note (opzionale)</div>
            <input
              style={{ width: "100%", background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "var(--font-sans)" }}
              placeholder="es. ben cotta, senza sale..."
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </div>

          {/* RIEPILOGO MODIFICHE */}
          {(rimossi.size > 0 || aggiunti.size > 0) && (
            <div style={{ padding: "10px 14px", background: "rgba(212,168,83,0.08)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 10, fontSize: 12, marginBottom: 16 }}>
              {rimossi.size > 0 && (
                <div style={{ color: "#c84040", marginBottom: 4 }}>
                  ✗ Senza: {ingredientiBase.filter((i) => rimossi.has(i.id)).map((i) => i.nome).join(", ")}
                </div>
              )}
              {aggiunti.size > 0 && (
                <div style={{ color: "var(--terracotta)" }}>
                  + Aggiunti: {Array.from(aggiunti.values()).map((i) => i.nome).join(", ")}
                </div>
              )}
              {prezzoExtra > 0 && (
                <div style={{ color: "#d4a853", fontFamily: "var(--font-mono)", marginTop: 4, fontWeight: 600 }}>
                  Sovrapprezzo: +€{prezzoExtra.toFixed(2)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer con quantità e prezzo */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", background: "var(--surface-high)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Quantità:</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 600, minWidth: 20, textAlign: "center" }}>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600, color: "#d4a853" }}>€{prezzoTotale.toFixed(2)}</div>
              {prezzoExtra > 0 && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>€{prezzoBase.toFixed(2)} + €{prezzoExtra.toFixed(2)} extra × {qty}</div>}
            </div>
          </div>
          <button
            onClick={conferma}
            style={{ width: "100%", background: "var(--terracotta)", color: "white", border: "none", padding: 14, borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)" }}
          >
            ✓ Aggiungi al carrello
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

  const [menuItems, setMenuItems]       = useState<any[]>([]);
  const [ingredienti, setIngredienti]   = useState<Ingrediente[]>([]);
  const [sedi, setSedi]                 = useState<any[]>([]);
  const [sedeSelezionata, setSedeSelezionata] = useState(user?.sedeId ?? "");
  const [catFiltro, setCatFiltro]       = useState("pizze_rosse");
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [canale, setCanale]             = useState<"walk_in"|"telefono">("walk_in");
  const [tipo, setTipo]                 = useState<"asporto"|"domicilio"|"tavolo">("asporto");
  const [clienteNome, setClienteNome]   = useState("");
  const [clienteTel, setClienteTel]     = useState("");
  const [clienteIndirizzo, setClienteIndirizzo] = useState("");
  const [note, setNote]                 = useState("");
  const [loading, setLoading]           = useState(false);
  const [pizzaConfig, setPizzaConfig]   = useState<any | null>(null); // pizza in configurazione

  // Carica sedi
  useEffect(() => {
    fetch("/api/sedi").then((r) => r.json()).then((data) => {
      setSedi(Array.isArray(data) ? data : []);
      if (!sedeSelezionata && data.length > 0) setSedeSelezionata(data[0].id);
    });
  }, []);

  // Carica menù e ingredienti quando cambia sede
  useEffect(() => {
    if (!sedeSelezionata) return;
    fetch(`/api/menu?sedeId=${sedeSelezionata}`)
      .then((r) => r.json())
      .then((data) => {
        const items = (data.items ?? []).filter((i: any) => i.disponibileInSede !== false && i.isAttivo);
        setMenuItems(items);
      });
    fetch(`/api/ingredienti?sedeId=${sedeSelezionata}`)
      .then((r) => r.json())
      .then((data) => setIngredienti(Array.isArray(data) ? data : []));
  }, [sedeSelezionata]);

  const cats = ["pizze_rosse", "pizze_bianche", "calzoni", "fritti", "bevande", "dolci", "extra"];
  const catsPresenti = cats.filter((c) => menuItems.some((m) => m.categoria === c));
  const itemsFiltrati = menuItems.filter((m) => m.categoria === catFiltro);

  // Click su pizza → apri modale configurazione
  const handleClickItem = (item: any) => {
    const isPizza = ["pizze_rosse", "pizze_bianche", "calzoni"].includes(item.categoria);
    if (isPizza) {
      setPizzaConfig(item);
    } else {
      // Prodotto semplice (bibita, fritto) → aggiungi direttamente
      addSimpleItem(item);
    }
  };

  const addSimpleItem = (item: any) => {
    const prezzo = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
    setCart((prev) => {
      const ex = prev.find((c) => c.menuItemId === item.id && c.ingredientiAggiunti.length === 0 && c.ingredientiRimossi.length === 0);
      if (ex) return prev.map((c) => c.cartId === ex.cartId ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, {
        cartId: crypto.randomUUID(),
        menuItemId: item.id,
        nome: item.nome,
        prezzoBase: prezzo,
        qty: 1,
        ingredientiRimossi: [],
        ingredientiAggiunti: [],
        noteItem: "",
        prezzoTotaleItem: prezzo,
      }];
    });
    toast.success(`${item.nome} aggiunto!`, { duration: 1000 });
  };

  const addConfiguredItem = (cartItem: CartItem) => {
    setCart((prev) => [...prev, cartItem]);
    setPizzaConfig(null);
    toast.success(`${cartItem.nome} aggiunto!`, { duration: 1200 });
  };

  const removeFromCart = (cartId: string) => {
    setCart((prev) => {
      const item = prev.find((c) => c.cartId === cartId);
      if (!item) return prev;
      if (item.qty === 1) return prev.filter((c) => c.cartId !== cartId);
      return prev.map((c) => c.cartId === cartId ? { ...c, qty: c.qty - 1 } : c);
    });
  };

  const totale = cart.reduce((acc, c) => acc + c.prezzoTotaleItem * c.qty, 0);
  const nomeSede = sedi.find((s) => s.id === sedeSelezionata)?.nome ?? "";

  const confermaOrdine = async () => {
    if (!cart.length) return toast.error("Aggiungi almeno un prodotto");
    if (!sedeSelezionata) return toast.error("Seleziona una sede");
    setLoading(true);

    const res = await fetch("/api/ordini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sedeId: sedeSelezionata,
        canale,
        tipo,
        clienteNome: clienteNome || "Cliente anonimo",
        clienteTelefono: clienteTel || null,
        clienteIndirizzo: tipo === "domicilio" ? clienteIndirizzo : null,
        note: note || null,
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          nomeSnapshot: buildNomeSnapshot(c),
          prezzoSnapshot: c.prezzoTotaleItem,
          quantita: c.qty,
          noteItem: buildNoteItem(c),
          ingredientiRimossi: c.ingredientiRimossi.map((i) => i.id),
        })),
      }),
    });

    setLoading(false);

    if (res.ok) {
      const ordine = await res.json();
      toast.success(`Ordine #${ordine.numeroOrdine} creato! 🍕`);
      stampaBrowser({
        numero: ordine.numeroOrdine,
        sede: nomeSede,
        canale,
        tipo,
        cliente: clienteNome || "Cliente anonimo",
        telefono: clienteTel,
        indirizzo: clienteIndirizzo,
        items: cart.map((c) => ({
          nome: buildNomeSnapshot(c),
          qty: c.qty,
          prezzo: c.prezzoTotaleItem,
          note: buildNoteItem(c) || undefined,
        })),
        totale,
        note,
        ora: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      });
      setCart([]);
      setClienteNome(""); setClienteTel(""); setClienteIndirizzo(""); setNote("");
    } else {
      toast.error("Errore nella creazione dell'ordine");
    }
  };

  return (
    <div className="animate-in" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, height: "calc(100vh - 104px)" }}>

      {/* MENU PICKER */}
      <div style={{ overflowY: "auto", paddingRight: 4 }}>
        {/* Sede selector (solo admin) */}
        {isSuperAdmin && (
          <div style={{ marginBottom: 12 }}>
            <select
              value={sedeSelezionata}
              onChange={(e) => setSedeSelezionata(e.target.value)}
              style={{ width: "100%", background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}
            >
              {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
        )}

        {/* Filtro categorie */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {catsPresenti.map((c) => {
            const col = CAT_COLOR[c] ?? "var(--terracotta)";
            return (
              <button key={c} onClick={() => setCatFiltro(c)} style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                border: "1px solid", fontFamily: "var(--font-sans)", transition: "all 0.15s",
                background: catFiltro === c ? `${col}20` : "transparent",
                borderColor: catFiltro === c ? col : "var(--border)",
                color: catFiltro === c ? col : "var(--text-dim)",
                fontWeight: catFiltro === c ? 600 : 400,
              }}>{CAT_LABEL[c] ?? c}</button>
            );
          })}
        </div>

        {/* Griglia prodotti */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px,1fr))", gap: 10 }}>
          {itemsFiltrati.map((item) => {
            const prezzo = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
            const col = CAT_COLOR[item.categoria] ?? "var(--terracotta)";
            const isPizza = ["pizze_rosse","pizze_bianche","calzoni"].includes(item.categoria);
            const nInCart = cart.filter((c) => c.menuItemId === item.id).reduce((a,c)=>a+c.qty, 0);
            return (
              <div
                key={item.id}
                onClick={() => handleClickItem(item)}
                style={{
                  background: "var(--surface)", border: `1px solid ${nInCart > 0 ? col : "var(--border)"}`,
                  borderRadius: 10, padding: 14, cursor: "pointer", transition: "border 0.15s",
                  position: "relative",
                }}
              >
                {nInCart > 0 && (
                  <div style={{ position: "absolute", top: 8, right: 8, background: col, color: "white", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                    {nInCart}
                  </div>
                )}
                <div style={{ marginBottom: 4 }}>
                  <span style={{ background: `${col}20`, color: col, padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>
                    {CAT_LABEL[item.categoria]?.split(" ").slice(1).join(" ") ?? item.categoria}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--cream)", marginBottom: 3 }}>{item.nome}</div>
                {item.descrizione && <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 8, lineHeight: 1.3 }}>{item.descrizione}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 500, color: "#d4a853" }}>€{prezzo.toFixed(2)}</span>
                  {isPizza && <span style={{ fontSize: 10, color: "var(--text-dim)" }}>+ personalizza</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CARRELLO */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 700, color: "var(--cream)" }}>
          🛒 Ordine in corso
        </div>

        {/* Canale + Tipo */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {(["walk_in","telefono"] as const).map((c) => (
              <button key={c} onClick={() => setCanale(c)} style={{ flex: 1, padding: "6px 4px", borderRadius: 7, border: "1px solid", fontFamily: "var(--font-sans)", fontSize: 12, cursor: "pointer", background: canale === c ? "rgba(200,90,46,0.15)" : "var(--surface-high)", borderColor: canale === c ? "rgba(200,90,46,0.4)" : "var(--border)", color: canale === c ? "var(--terracotta)" : "var(--text-dim)" }}>
                {c === "walk_in" ? "🚶 Walk-in" : "📞 Telefono"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {(["asporto","domicilio","tavolo"] as const).map((t) => (
              <button key={t} onClick={() => setTipo(t)} style={{ flex: 1, padding: "4px 2px", borderRadius: 6, border: "1px solid", fontFamily: "var(--font-sans)", fontSize: 11, cursor: "pointer", background: tipo === t ? "rgba(200,90,46,0.15)" : "transparent", borderColor: tipo === t ? "rgba(200,90,46,0.4)" : "var(--border)", color: tipo === t ? "var(--terracotta)" : "var(--text-dim)" }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Cliente */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 7 }}>
          <input style={inputSt} placeholder="Nome cliente" value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
          <input style={inputSt} placeholder="Telefono (opzionale)" value={clienteTel} onChange={(e) => setClienteTel(e.target.value)} />
          {tipo === "domicilio" && <input style={inputSt} placeholder="Indirizzo *" value={clienteIndirizzo} onChange={(e) => setClienteIndirizzo(e.target.value)} />}
        </div>

        {/* Items carrello */}
        <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 12px", color: "var(--text-dim)" }}>
              <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>🍕</div>
              <div style={{ fontSize: 12 }}>Seleziona prodotti dal menù</div>
            </div>
          ) : cart.map((item) => (
            <div key={item.cartId} style={{ background: "var(--surface-high)", borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.nome}</div>
                  {(item.ingredientiRimossi.length > 0 || item.ingredientiAggiunti.length > 0) && (
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>
                      {item.ingredientiRimossi.length > 0 && <span style={{ color: "#c84040" }}>✗ {item.ingredientiRimossi.map(i=>i.nome).join(", ")} </span>}
                      {item.ingredientiAggiunti.length > 0 && <span style={{ color: "var(--terracotta)" }}>+ {item.ingredientiAggiunti.map(i=>i.nome).join(", ")}</span>}
                    </div>
                  )}
                  {item.noteItem && <div style={{ fontSize: 10, color: "var(--text-dim)", fontStyle: "italic" }}>{item.noteItem}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <button onClick={() => removeFromCart(item.cartId)} style={qtyBtnSt}>−</button>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, minWidth: 14, textAlign: "center" }}>{item.qty}</span>
                  <button onClick={() => setCart((prev) => prev.map((c) => c.cartId === item.cartId ? { ...c, qty: c.qty + 1 } : c))} style={qtyBtnSt}>+</button>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#d4a853", minWidth: 52, textAlign: "right" }}>
                  €{(item.prezzoTotaleItem * item.qty).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Note + footer */}
        <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border)" }}>
          <textarea style={{ ...inputSt, resize: "none", fontSize: 12 } as any} placeholder="Note ordine..." value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </div>
        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: "var(--text-dim)" }}>Totale</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600, color: "#d4a853" }}>€{totale.toFixed(2)}</span>
          </div>
          <button onClick={confermaOrdine} disabled={loading || cart.length === 0} style={{ width: "100%", background: cart.length === 0 ? "var(--border)" : "var(--terracotta)", color: "white", border: "none", padding: 13, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: cart.length === 0 ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)" }}>
            {loading ? "Invio..." : "✅ Conferma + Stampa"}
          </button>
        </div>
      </div>

      {/* MODALE CONFIGURAZIONE PIZZA */}
      {pizzaConfig && (
        <PizzaConfigModal
          item={pizzaConfig}
          tuttiIngredienti={ingredienti}
          sedeId={sedeSelezionata}
          onConferma={addConfiguredItem}
          onChiudi={() => setPizzaConfig(null)}
        />
      )}
    </div>
  );
}

// ── Utility ──────────────────────────────────────────────────
function buildNomeSnapshot(c: CartItem): string {
  let nome = c.nome;
  if (c.ingredientiAggiunti.length > 0) nome += ` +${c.ingredientiAggiunti.map(i=>i.nome).join("+")}`;
  if (c.ingredientiRimossi.length > 0)  nome += ` -${c.ingredientiRimossi.map(i=>i.nome).join("-")}`;
  return nome;
}

function buildNoteItem(c: CartItem): string {
  const parts: string[] = [];
  if (c.ingredientiRimossi.length > 0)  parts.push(`Senza: ${c.ingredientiRimossi.map(i=>i.nome).join(", ")}`);
  if (c.ingredientiAggiunti.length > 0) parts.push(`Con: ${c.ingredientiAggiunti.map(i=>i.nome).join(", ")}`);
  if (c.noteItem) parts.push(c.noteItem);
  return parts.join(" | ");
}

// Stili inline riutilizzabili
const inputSt: React.CSSProperties = {
  width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
  color: "var(--text)", padding: "7px 10px", borderRadius: 7, fontSize: 12,
  outline: "none", fontFamily: "var(--font-sans)",
};

const qtyBtnSt: React.CSSProperties = {
  width: 22, height: 22, borderRadius: 4, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", cursor: "pointer",
  fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
};
