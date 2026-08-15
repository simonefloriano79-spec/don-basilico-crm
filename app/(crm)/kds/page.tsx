"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { stampaBrowser } from "@/lib/print";

const STATI_FLOW = ["nuovo","confermato","in_preparazione","pronto","consegnato"];
const STATO_LABEL: Record<string,string> = { nuovo:"NUOVO", confermato:"CONFERMATO", in_preparazione:"IN PREP." };
const NEXT_LABEL: Record<string,string> = { nuovo:"Conferma", confermato:"Inizia", in_preparazione:"✅ PRONTO!" };
const STATO_COLOR: Record<string,string> = { nuovo:"#4a7ec8", confermato:"#d4a853", in_preparazione:"#c85a2e" };
const CANALE_ICON: Record<string,string> = { online:"🌐", telefono:"📞", walk_in:"🚶" };

export default function KDSPage() {
  const { data: session } = useSession();
  const [ordini, setOrdini] = useState<any[]>([]);
  const user = session?.user as any;

  const carica = useCallback(async () => {
    const sedeParam = user?.ruolo !== "super_admin" && user?.sedeId ? `&sedeId=${user.sedeId}` : "";
    const res = await fetch(`/api/ordini?limit=100${sedeParam}`);
    const all = await res.json();
    setOrdini((Array.isArray(all) ? all : []).filter((o: any) => ["nuovo","confermato","in_preparazione"].includes(o.stato)));
  }, [user]);

  useEffect(() => { carica(); const iv = setInterval(carica, 15000); return () => clearInterval(iv); }, [carica]);

  const avanza = async (ordine: any) => {
    const idx = STATI_FLOW.indexOf(ordine.stato);
    if (idx >= STATI_FLOW.length - 1) return;
    const newStato = STATI_FLOW[idx + 1];
    const res = await fetch(`/api/ordini/${ordine.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stato: newStato }) });
    if (res.ok) { if (newStato === "pronto") toast.success(`#${ordine.numeroOrdine} PRONTO! 🔔`); carica(); }
  };

  const annulla = async (ordine: any) => {
    if (!confirm(`Annullare l'ordine #${ordine.numeroOrdine}?`)) return;
    const res = await fetch(`/api/ordini/${ordine.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stato: "annullato" }) });
    if (res.ok) { toast.success(`#${ordine.numeroOrdine} annullato`); carica(); }
  };

  const stampa = async (ordine: any) => {
    stampaBrowser({
      numero: ordine.numeroOrdine, sede: ordine.sede?.nome ?? "", canale: ordine.canale, tipo: ordine.tipo,
      cliente: ordine.clienteNome ?? "Anonimo", telefono: ordine.clienteTelefono, indirizzo: ordine.clienteIndirizzo,
      items: (ordine.items ?? []).map((i: any) => ({ nome: i.nomeSnapshot, qty: i.quantita, prezzo: parseFloat(i.prezzoSnapshot), note: i.noteItem })),
      totale: parseFloat(ordine.totale), note: ordine.note,
      ora: new Date(ordine.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    });
    await fetch(`/api/ordini/${ordine.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stampato: true }) });
    carica();
  };

  return (
    <div className="animate-in">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4a9e6b", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 13, color: "#4a9e6b" }}>Live · 15s</span>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-dim)" }}>{ordini.length} in lavorazione</span>
        <button onClick={carica} style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "6px 12px", borderRadius: 8, fontSize: 13 }}>↻</button>
      </div>

      {ordini.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 56, marginBottom: 12, opacity: 0.3 }}>🍕</div>
          <div style={{ fontSize: 16, color: "var(--text-dim)" }}>Nessun ordine in lavorazione</div>
        </div>
      ) : (
        /* Grid responsive: 1 col mobile, 2 col tablet, 3 col desktop */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {ordini.map((ordine) => (
            <div key={ordine.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", borderTop: `4px solid ${STATO_COLOR[ordine.stato] ?? "var(--border)"}` }}>
              {/* Header */}
              <div style={{ padding: "12px 16px", background: "var(--surface-high)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: "var(--cream)" }}>#{ordine.numeroOrdine}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{new Date(ordine.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: STATO_COLOR[ordine.stato] }}>{STATO_LABEL[ordine.stato]}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{CANALE_ICON[ordine.canale]} {ordine.tipo}</div>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 10 }}>
                  👤 {ordine.clienteNome || "Anonimo"}
                  {ordine.clienteTelefono && ` · 📞 ${ordine.clienteTelefono}`}
                </div>
                {(ordine.items ?? []).map((item: any, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: i < (ordine.items?.length ?? 0) - 1 ? "1px solid var(--border)" : "none", fontSize: 14 }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--terracotta)", fontWeight: 700, minWidth: 28 }}>{item.quantita}x</span>
                    <div>
                      <div>{item.nomeSnapshot}</div>
                      {item.noteItem && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>→ {item.noteItem}</div>}
                    </div>
                  </div>
                ))}
                {ordine.note && (
                  <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(212,168,83,0.1)", borderRadius: 6, fontSize: 12, color: "#d4a853" }}>
                    📝 {ordine.note}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
                {!ordine.stampato && (
                  <button onClick={() => stampa(ordine)} style={{ background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.3)", color: "#d4a853", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>🖨️ Stampa</button>
                )}
                <button onClick={() => avanza(ordine)} style={{ flex: 1, background: ordine.stato === "in_preparazione" ? "#4a9e6b" : "var(--terracotta)", border: "none", color: "white", padding: "10px", borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
                  {NEXT_LABEL[ordine.stato]} →
                </button>
                <button onClick={() => annulla(ordine)} title="Annulla ordine" style={{ background: "rgba(200,64,64,0.1)", border: "1px solid rgba(200,64,64,0.3)", color: "#c84040", padding: "10px 12px", borderRadius: 8, fontSize: 14 }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
