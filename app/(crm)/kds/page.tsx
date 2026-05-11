"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { stampaBrowser } from "@/lib/print";

const STATI_FLOW = ["nuovo", "confermato", "in_preparazione", "pronto", "consegnato"];

const STATO_LABEL: Record<string, string> = {
  nuovo: "NUOVO",
  confermato: "CONFERMATO",
  in_preparazione: "IN PREP.",
};

const NEXT_LABEL: Record<string, string> = {
  nuovo: "Conferma",
  confermato: "Inizia",
  in_preparazione: "Pronto! 🔔",
};

const STATO_COLOR: Record<string, string> = {
  nuovo: "#4a7ec8",
  confermato: "#d4a853",
  in_preparazione: "#c85a2e",
};

export default function KDSPage() {
  const { data: session } = useSession();
  const [ordini, setOrdini] = useState<any[]>([]);
  const user = session?.user as any;

  const caricaOrdini = useCallback(async () => {
    const sedeParam = user?.ruolo !== "super_admin" && user?.sedeId ? `&sedeId=${user.sedeId}` : "";
    const res = await fetch(`/api/ordini?stato=nuovo${sedeParam}&limit=50`);
    const data = await res.json();
    // Prende anche confermati e in_preparazione
    const resAll = await fetch(`/api/ordini?limit=100${sedeParam}`);
    const all = await resAll.json();
    setOrdini(all.filter((o: any) => ["nuovo", "confermato", "in_preparazione"].includes(o.stato)));
  }, [user]);

  useEffect(() => {
    caricaOrdini();
    const interval = setInterval(caricaOrdini, 15000);
    return () => clearInterval(interval);
  }, [caricaOrdini]);

  const avanzaStato = async (ordine: any) => {
    const idx = STATI_FLOW.indexOf(ordine.stato);
    if (idx >= STATI_FLOW.length - 1) return;
    const newStato = STATI_FLOW[idx + 1];

    const res = await fetch(`/api/ordini/${ordine.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stato: newStato }),
    });

    if (res.ok) {
      if (newStato === "pronto") {
        toast.success(`#${ordine.numeroOrdine} è PRONTO! 🔔`);
      }
      caricaOrdini();
    }
  };

  const gestisciStampa = async (ordine: any) => {
    stampaBrowser({
      numero: ordine.numeroOrdine,
      sede: ordine.sede?.nome ?? "",
      canale: ordine.canale,
      tipo: ordine.tipo,
      cliente: ordine.clienteNome ?? "Anonimo",
      telefono: ordine.clienteTelefono,
      indirizzo: ordine.clienteIndirizzo,
      items: (ordine.items ?? []).map((i: any) => ({
        nome: i.nomeSnapshot,
        qty: i.quantita,
        prezzo: parseFloat(i.prezzoSnapshot),
        note: i.noteItem,
      })),
      totale: parseFloat(ordine.totale),
      note: ordine.note,
      ora: new Date(ordine.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    });

    await fetch(`/api/ordini/${ordine.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stampato: true }),
    });

    caricaOrdini();
  };

  const CANALE_ICON: Record<string, string> = { online: "🌐", telefono: "📞", walk_in: "🚶" };

  return (
    <div className="animate-in">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4a9e6b", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 13, color: "#4a9e6b" }}>Live · aggiornamento ogni 15s</span>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-dim)" }}>
          {ordini.length} ordini in lavorazione
        </span>
        <button
          onClick={caricaOrdini}
          style={{
            background: "var(--surface-high)", border: "1px solid var(--border)",
            color: "var(--text-dim)", padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer",
            fontFamily: "var(--font-sans)",
          }}
        >
          ↻ Aggiorna
        </button>
      </div>

      {ordini.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px" }}>
          <div style={{ fontSize: 56, marginBottom: 12, opacity: 0.3 }}>🍕</div>
          <div style={{ fontSize: 16, color: "var(--text-dim)" }}>Nessun ordine in lavorazione</div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>I nuovi ordini appariranno qui automaticamente</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {ordini.map((ordine) => (
            <div key={ordine.id} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 12, overflow: "hidden",
              borderTop: `3px solid ${STATO_COLOR[ordine.stato] ?? "var(--border)"}`,
            }}>
              {/* Header */}
              <div style={{ padding: "12px 16px", background: "var(--surface-high)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, color: "var(--cream)" }}>
                    #{ordine.numeroOrdine}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    {new Date(ordine.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: STATO_COLOR[ordine.stato], marginBottom: 4 }}>
                    {STATO_LABEL[ordine.stato]}
                  </div>
                  <span style={{
                    background: "var(--surface)", border: "1px solid var(--border)",
                    padding: "2px 8px", borderRadius: 6, fontSize: 11, color: "var(--text-dim)",
                  }}>
                    {CANALE_ICON[ordine.canale]} {ordine.canale.replace("_", "-")}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>
                  👤 {ordine.clienteNome || "Anonimo"} · {ordine.tipo}
                  {ordine.clienteTelefono && ` · 📞 ${ordine.clienteTelefono}`}
                </div>
                {(ordine.items ?? []).map((item: any, i: number) => (
                  <div key={i} style={{
                    display: "flex", gap: 8, padding: "6px 0",
                    borderBottom: i < ordine.items.length - 1 ? "1px solid var(--border)" : "none",
                    fontSize: 13,
                  }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--terracotta)", fontWeight: 600, minWidth: 24 }}>
                      {item.quantita}x
                    </span>
                    <span>
                      {item.nomeSnapshot}
                      {item.noteItem && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>→ {item.noteItem}</div>}
                    </span>
                  </div>
                ))}
                {ordine.note && (
                  <div style={{
                    marginTop: 8, padding: "6px 10px", background: "rgba(212,168,83,0.1)",
                    border: "1px solid rgba(212,168,83,0.2)", borderRadius: 6, fontSize: 12, color: "#d4a853",
                  }}>
                    📝 {ordine.note}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
                {!ordine.stampato && (
                  <button
                    onClick={() => gestisciStampa(ordine)}
                    style={{
                      background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.3)",
                      color: "#d4a853", padding: "6px 12px", borderRadius: 8, fontSize: 12,
                      fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)",
                      display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    🖨️ Stampa
                  </button>
                )}
                {ordine.stato !== "pronto" && (
                  <button
                    onClick={() => avanzaStato(ordine)}
                    style={{
                      flex: 1, background: "var(--terracotta)", border: "none",
                      color: "white", padding: "8px", borderRadius: 8, fontSize: 13,
                      fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)",
                    }}
                  >
                    {NEXT_LABEL[ordine.stato]} →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
