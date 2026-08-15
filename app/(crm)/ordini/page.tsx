"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { stampaBrowser } from "@/lib/print";

const STATI_FLOW = ["nuovo", "confermato", "in_preparazione", "pronto", "consegnato"];
const STATO_COLORS: Record<string, string> = {
  nuovo: "#4a7ec8", confermato: "#d4a853", in_preparazione: "#c85a2e",
  pronto: "#4a9e6b", consegnato: "#8a7a65", annullato: "#c84040",
};
const CANALE_ICON: Record<string, string> = { online: "🌐", telefono: "📞", walk_in: "🚶" };

export default function OrdiniPage() {
  const { data: session } = useSession();
  const [ordini, setOrdini] = useState<any[]>([]);
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [filtroCanale, setFiltroCanale] = useState("tutti");
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";

  const caricaOrdini = useCallback(async () => {
    const sedeParam = !isSuperAdmin && user?.sedeId ? `&sedeId=${user.sedeId}` : "";
    const statoParam = filtroStato !== "tutti" ? `&stato=${filtroStato}` : "";
    const canaleParam = filtroCanale !== "tutti" ? `&canale=${filtroCanale}` : "";
    const res = await fetch(`/api/ordini?limit=80${sedeParam}${statoParam}${canaleParam}`);
    const data = await res.json();
    setOrdini(Array.isArray(data) ? data : []);
  }, [filtroStato, filtroCanale, isSuperAdmin, user?.sedeId]);

  useEffect(() => { caricaOrdini(); }, [caricaOrdini]);

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
      toast.success(`Stato → ${newStato.replace("_", " ")}`);
      caricaOrdini();
    }
  };

  const annullaOrdine = async (ordine: any) => {
    if (!confirm(`Annullare l'ordine #${ordine.numeroOrdine}?`)) return;
    const res = await fetch(`/api/ordini/${ordine.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stato: "annullato" }),
    });
    if (res.ok) {
      toast.success(`Ordine #${ordine.numeroOrdine} annullato`);
      caricaOrdini();
    } else {
      toast.error("Errore durante l'annullamento");
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
      items: (ordine.items ?? []).map((i: any) => ({ nome: i.nomeSnapshot, qty: i.quantita, prezzo: parseFloat(i.prezzoSnapshot), note: i.noteItem })),
      totale: parseFloat(ordine.totale),
      note: ordine.note,
      ora: new Date(ordine.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    });
    await fetch(`/api/ordini/${ordine.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stampato: true }) });
    caricaOrdini();
  };

  return (
    <div className="animate-in">
      {/* Filtri */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["tutti", "nuovo", "confermato", "in_preparazione", "pronto", "consegnato"].map((s) => (
            <button key={s} onClick={() => setFiltroStato(s)} style={{
              padding: "4px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: `1px solid ${filtroStato === s ? (STATO_COLORS[s] ?? "var(--terracotta)") : "var(--border)"}`,
              background: filtroStato === s ? `${STATO_COLORS[s] ?? "var(--terracotta)"}15` : "transparent",
              color: filtroStato === s ? (STATO_COLORS[s] ?? "var(--terracotta)") : "var(--text-dim)",
              fontFamily: "var(--font-sans)",
            }}>{s === "tutti" ? "Tutti" : s.replace("_", " ")}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {["tutti", "online", "telefono", "walk_in"].map((c) => (
            <button key={c} onClick={() => setFiltroCanale(c)} style={{
              padding: "4px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: `1px solid ${filtroCanale === c ? "var(--terracotta)" : "var(--border)"}`,
              background: filtroCanale === c ? "rgba(200,90,46,0.1)" : "transparent",
              color: filtroCanale === c ? "var(--terracotta)" : "var(--text-dim)",
              fontFamily: "var(--font-sans)",
            }}>{c === "tutti" ? "Tutti" : c.replace("_", " ")}</button>
          ))}
          <button onClick={caricaOrdini} style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: "1px solid var(--border)", background: "transparent", color: "var(--text-dim)", fontFamily: "var(--font-sans)" }}>↻</button>
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-high)" }}>
              {["#", ...(isSuperAdmin ? ["Sede"] : []), "Cliente", "Canale", "Tipo", "Prodotti", "Totale", "Stato", "Azioni"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordini.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--text-dim)", fontSize: 13 }}>Nessun ordine trovato</td></tr>
            ) : ordini.map((o) => (
              <tr key={o.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", color: "var(--text-dim)", fontSize: 13 }}>#{o.numeroOrdine}</td>
                {isSuperAdmin && <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-dim)" }}>{o.sede?.nome}</td>}
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{o.clienteNome || "Anonimo"}</div>
                  {o.clienteTelefono && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{o.clienteTelefono}</div>}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ background: "var(--surface-high)", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: 6, fontSize: 11, color: "var(--text-dim)" }}>
                    {CANALE_ICON[o.canale]} {o.canale.replace("_", "-")}
                  </span>
                </td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-dim)", textTransform: "capitalize" }}>{o.tipo}</td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-dim)", maxWidth: 200 }}>
                  {(o.items ?? []).slice(0, 2).map((i: any) => `${i.quantita}x ${i.nomeSnapshot}`).join(", ")}
                  {(o.items ?? []).length > 2 && ` +${o.items.length - 2}`}
                </td>
                <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", color: "#d4a853", fontSize: 13 }}>€{parseFloat(o.totale).toFixed(2)}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px",
                    borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                    background: `${STATO_COLORS[o.stato] ?? "var(--border)"}20`,
                    color: STATO_COLORS[o.stato] ?? "var(--text-dim)",
                  }}>● {o.stato.replace("_", " ")}</span>
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {!o.stampato && (
                      <button onClick={() => gestisciStampa(o)} style={{
                        background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.3)",
                        color: "#d4a853", padding: "5px 10px", borderRadius: 8, fontSize: 12,
                        cursor: "pointer", fontFamily: "var(--font-sans)",
                      }}>🖨️</button>
                    )}
                    {!["consegnato", "annullato"].includes(o.stato) && (
                      <button onClick={() => avanzaStato(o)} style={{
                        background: "var(--surface-high)", border: "1px solid var(--border)",
                        color: "var(--text)", padding: "5px 10px", borderRadius: 8, fontSize: 12,
                        cursor: "pointer", fontFamily: "var(--font-sans)",
                      }}>→</button>
                    )}
                    {!["consegnato", "annullato"].includes(o.stato) && (
                      <button onClick={() => annullaOrdine(o)} title="Annulla ordine" style={{
                        background: "rgba(200,64,64,0.1)", border: "1px solid rgba(200,64,64,0.3)",
                        color: "#c84040", padding: "5px 10px", borderRadius: 8, fontSize: 12,
                        cursor: "pointer", fontFamily: "var(--font-sans)",
                      }}>✕</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
