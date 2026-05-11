"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { stampaBrowser } from "@/lib/print";

const CAT_COLORS: Record<string, string> = {
  pizze: "#c85a2e", fritti: "#d4a853", bevande: "#4a7ec8",
  dolci: "#4a9e6b", extra: "#8a7a65",
};

interface CartItem {
  id: string; nome: string; prezzo: number; qty: number;
  menuItemId?: string; sedeExtraId?: string; noteItem?: string;
}

export default function NuovoOrdinePage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [sedi, setSedi] = useState<any[]>([]);
  const [sedeSelezionata, setSedeSelezionata] = useState(user?.sedeId ?? "");
  const [catFiltro, setCatFiltro] = useState("tutti");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [canale, setCanale] = useState<"walk_in" | "telefono">("walk_in");
  const [tipo, setTipo] = useState<"asporto" | "domicilio" | "tavolo">("asporto");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTel, setClienteTel] = useState("");
  const [clienteIndirizzo, setClienteIndirizzo] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/sedi").then((r) => r.json()).then((data) => {
      setSedi(data);
      if (!sedeSelezionata && data.length > 0) setSedeSelezionata(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!sedeSelezionata) return;
    fetch(`/api/menu?sedeId=${sedeSelezionata}`)
      .then((r) => r.json())
      .then((data) => setMenuItems((data.items ?? []).filter((i: any) => i.disponibileInSede && i.isAttivo)));
  }, [sedeSelezionata]);

  const cats = ["tutti", ...new Set(menuItems.map((m) => m.categoria))] as string[];
  const itemsFiltrati = menuItems.filter((m) => catFiltro === "tutti" || m.categoria === catFiltro);

  const addToCart = (item: any) => {
    const prezzo = item.prezzoEffettivo ?? parseFloat(item.prezzoBase);
    setCart((prev) => {
      const ex = prev.find((c) => c.id === item.id);
      if (ex) return prev.map((c) => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: item.id, nome: item.nome, prezzo, qty: 1, menuItemId: item.id }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === id);
      if (!ex) return prev;
      if (ex.qty === 1) return prev.filter((c) => c.id !== id);
      return prev.map((c) => c.id === id ? { ...c, qty: c.qty - 1 } : c);
    });
  };

  const totale = cart.reduce((acc, c) => acc + c.prezzo * c.qty, 0);
  const nomeSede = sedi.find((s) => s.id === sedeSelezionata)?.nome ?? "";

  const conferma = async () => {
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
        items: cart.flatMap((c) =>
          Array.from({ length: 1 }).map(() => ({
            menuItemId: c.menuItemId ?? null,
            nomeSnapshot: c.nome,
            prezzoSnapshot: c.prezzo,
            quantita: c.qty,
            noteItem: c.noteItem ?? null,
          }))
        ),
      }),
    });

    setLoading(false);

    if (res.ok) {
      const ordine = await res.json();
      toast.success(`Ordine #${ordine.numeroOrdine} creato! 🍕`);

      // Stampa automatica
      stampaBrowser({
        numero: ordine.numeroOrdine,
        sede: nomeSede,
        canale,
        tipo,
        cliente: clienteNome || "Cliente anonimo",
        telefono: clienteTel,
        indirizzo: clienteIndirizzo,
        items: cart.map((c) => ({ nome: c.nome, qty: c.qty, prezzo: c.prezzo })),
        totale,
        note,
        ora: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      });

      setCart([]);
      setClienteNome("");
      setClienteTel("");
      setClienteIndirizzo("");
      setNote("");
    } else {
      toast.error("Errore nella creazione dell'ordine");
    }
  };

  const isSuperAdmin = user?.ruolo === "super_admin";

  return (
    <div className="animate-in" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, height: "calc(100vh - 104px)" }}>
      {/* MENU PICKER */}
      <div style={{ overflowY: "auto", paddingRight: 4 }}>
        {isSuperAdmin && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>Sede</label>
            <select
              value={sedeSelezionata}
              onChange={(e) => setSedeSelezionata(e.target.value)}
              style={{ display: "block", marginTop: 6, background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", borderRadius: 8, fontSize: 13, width: "100%" }}
            >
              {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {cats.map((c) => (
            <button key={c} onClick={() => setCatFiltro(c)} style={{
              padding: "4px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: "1px solid var(--border)", fontFamily: "var(--font-sans)",
              background: catFiltro === c ? `${CAT_COLORS[c] ?? "var(--terracotta)"}20` : "transparent",
              color: catFiltro === c ? (CAT_COLORS[c] ?? "var(--terracotta)") : "var(--text-dim)",
              borderColor: catFiltro === c ? (CAT_COLORS[c] ?? "var(--terracotta)") : "var(--border)",
            }}>{c}</button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {itemsFiltrati.map((item) => {
            const prezzo = item.prezzoEffettivo ?? parseFloat(item.prezzoBase);
            const inCart = cart.find((c) => c.id === item.id);
            const catColor = CAT_COLORS[item.categoria] ?? "var(--text-dim)";
            return (
              <div key={item.id} onClick={() => addToCart(item)} style={{
                background: "var(--surface)", border: `1px solid ${inCart ? catColor : "var(--border)"}`,
                borderRadius: 10, padding: 14, cursor: "pointer", transition: "border 0.15s",
                position: "relative",
              }}>
                {inCart && (
                  <div style={{
                    position: "absolute", top: 8, right: 8, background: "var(--terracotta)",
                    color: "white", width: 22, height: 22, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700,
                  }}>{inCart.qty}</div>
                )}
                <span style={{ background: `${catColor}20`, color: catColor, padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>{item.categoria}</span>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--cream)", marginTop: 6, marginBottom: 4 }}>{item.nome}</div>
                {item.descrizione && <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 8, lineHeight: 1.4 }}>{item.descrizione}</div>}
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 500, color: "#d4a853" }}>€{prezzo.toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CART PANEL */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 700, color: "var(--cream)" }}>
          🛒 Ordine in corso
        </div>

        {/* Canale + Tipo */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {(["walk_in", "telefono"] as const).map((c) => (
              <button key={c} onClick={() => setCanale(c)} style={{
                flex: 1, padding: "7px 4px", borderRadius: 7, border: "1px solid var(--border)",
                background: canale === c ? "rgba(200,90,46,0.15)" : "var(--surface-high)",
                color: canale === c ? "var(--terracotta)" : "var(--text-dim)",
                fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)",
                borderColor: canale === c ? "rgba(200,90,46,0.3)" : "var(--border)",
              }}>
                {c === "walk_in" ? "🚶 Walk-in" : "📞 Telefono"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["asporto", "domicilio", "tavolo"] as const).map((t) => (
              <button key={t} onClick={() => setTipo(t)} style={{
                flex: 1, padding: "5px 2px", borderRadius: 6, border: "1px solid var(--border)",
                background: tipo === t ? "rgba(200,90,46,0.15)" : "transparent",
                color: tipo === t ? "var(--terracotta)" : "var(--text-dim)",
                fontSize: 11, cursor: "pointer", fontFamily: "var(--font-sans)",
                borderColor: tipo === t ? "rgba(200,90,46,0.3)" : "var(--border)",
              }}>{t}</button>
            ))}
          </div>
        </div>

        {/* Cliente */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <input style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", borderRadius: 8, fontSize: 13, outline: "none" }}
            placeholder="Nome cliente" value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
          <input style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", borderRadius: 8, fontSize: 13, outline: "none" }}
            placeholder="Telefono (opzionale)" value={clienteTel} onChange={(e) => setClienteTel(e.target.value)} />
          {tipo === "domicilio" && (
            <input style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", borderRadius: 8, fontSize: 13, outline: "none" }}
              placeholder="Indirizzo consegna *" value={clienteIndirizzo} onChange={(e) => setClienteIndirizzo(e.target.value)} />
          )}
        </div>

        {/* Cart items */}
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-dim)" }}>
              <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.3 }}>🍕</div>
              <div style={{ fontSize: 13 }}>Seleziona prodotti dal menù</div>
            </div>
          ) : cart.map((item) => (
            <div key={item.id} style={{
              display: "flex", alignItems: "center", gap: 8, padding: 10,
              borderRadius: 8, background: "var(--surface-high)", marginBottom: 6,
            }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{item.nome}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => removeFromCart(item.id)} style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, minWidth: 16, textAlign: "center" }}>{item.qty}</span>
                <button onClick={() => addToCart({ id: item.id, nome: item.nome, prezzoEffettivo: item.prezzo })} style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#d4a853", minWidth: 54, textAlign: "right" }}>€{(item.prezzo * item.qty).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Note */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)" }}>
          <textarea style={{ width: "100%", background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", borderRadius: 8, fontSize: 12, resize: "none", outline: "none", fontFamily: "var(--font-sans)" }}
            placeholder="Note ordine..." value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: "var(--text-dim)" }}>Totale</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 500, color: "#d4a853" }}>€{totale.toFixed(2)}</span>
          </div>
          <button
            onClick={conferma}
            disabled={loading || cart.length === 0}
            style={{
              width: "100%", background: cart.length === 0 ? "var(--border)" : "var(--terracotta)",
              color: "white", border: "none", padding: 14, borderRadius: 10, fontSize: 15,
              fontWeight: 700, cursor: cart.length === 0 ? "not-allowed" : "pointer",
              fontFamily: "var(--font-sans)", transition: "background 0.15s",
            }}
          >
            {loading ? "Invio in corso..." : "✅ Conferma Ordine + Stampa"}
          </button>
        </div>
      </div>
    </div>
  );
}
