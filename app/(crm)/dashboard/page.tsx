"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Stats {
  ordiniAttivi: number;
  incassoOggi: number;
  pronti: number;
  online: number;
  sediStats: Array<{ id: string; nome: string; ordiniAttivi: number }>;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [ordiniRecenti, setOrdiniRecenti] = useState<any[]>([]);
  const user = session?.user as any;

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats);
    fetch("/api/ordini?limit=8").then((r) => r.json()).then(setOrdiniRecenti);

    // Polling ogni 30s
    const interval = setInterval(() => {
      fetch("/api/stats").then((r) => r.json()).then(setStats);
      fetch("/api/ordini?limit=8").then((r) => r.json()).then(setOrdiniRecenti);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const canaleIcon: Record<string, string> = { online: "🌐", telefono: "📞", walk_in: "🚶" };
  const statoColor: Record<string, string> = {
    nuovo: "#4a7ec8", confermato: "#d4a853",
    in_preparazione: "#c85a2e", pronto: "#4a9e6b",
    consegnato: "#8a7a65", annullato: "#c84040",
  };

  return (
    <div className="animate-in">
      {/* STAT CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Ordini attivi", value: stats?.ordiniAttivi ?? "—", sub: "In corso ora", accent: "#c85a2e" },
          { label: "Incasso oggi", value: stats ? `€${stats.incassoOggi.toFixed(0)}` : "—", sub: "Tutti i canali", accent: "#d4a853" },
          { label: "Pronti", value: stats?.pronti ?? "—", sub: "Da ritirare/consegnare", accent: "#4a9e6b" },
          { label: "Online oggi", value: stats?.online ?? "—", sub: "Ordini web/app", accent: "#4a7ec8" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
            padding: 20, position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: s.accent }} />
            <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--cream)" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* ORDINI RECENTI */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 700, color: "var(--cream)" }}>Ordini recenti</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4a9e6b", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 11, color: "#4a9e6b" }}>Live</span>
            </div>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-high)" }}>
                  {["#", "Cliente", "Canale", "Stato", "€"].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-dim)", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordiniRecenti.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-dim)", fontSize: 13 }}>Nessun ordine oggi</td></tr>
                ) : ordiniRecenti.map((o) => (
                  <tr key={o.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "var(--text-dim)", fontSize: 13 }}>#{o.numeroOrdine}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13 }}>{o.clienteNome || "Anonimo"}</td>
                    <td style={{ padding: "10px 12px" }}><span style={{ fontSize: 14 }}>{canaleIcon[o.canale]}</span></td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: `${statoColor[o.stato]}20`, color: statoColor[o.stato],
                      }}>● {o.stato.replace("_", " ")}</span>
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "#d4a853", fontSize: 13 }}>€{parseFloat(o.totale).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SEDI */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 700, color: "var(--cream)", marginBottom: 16 }}>Stato sedi</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(stats?.sediStats ?? []).map((s) => (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", background: "var(--surface-high)", borderRadius: 8,
                border: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.ordiniAttivi > 0 ? "#4a9e6b" : "var(--text-dim)" }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{s.nome}</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{s.ordiniAttivi} attivi</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
