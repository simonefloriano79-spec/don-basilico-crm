"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const CANALE_ICON: Record<string, string> = { online: "🌐", telefono: "📞", walk_in: "🚶" };
const STATO_COLOR: Record<string, string> = {
  nuovo: "#4a7ec8", confermato: "#d4a853", in_preparazione: "#c85a2e",
  pronto: "#4a9e6b", consegnato: "#8a7a65", annullato: "#c84040",
};

function StatCard({ label, value, sub, accent }: any) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
      padding: 20, position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent }} />
      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--cream)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<any>(null);
  const [ordiniRecenti, setOrdiniRecenti] = useState<any[]>([]);
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";

  const carica = () => {
    fetch("/api/stats").then((r) => r.json()).then(setStats);
    fetch("/api/ordini?limit=10").then((r) => r.json()).then((d) => setOrdiniRecenti(Array.isArray(d) ? d : []));
  };

  useEffect(() => {
    carica();
    const iv = setInterval(carica, 30000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="animate-in">

      {/* STAT CARDS GLOBALI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Ordini attivi" value={stats?.ordiniAttivi ?? "—"} sub="In corso ora" accent="#c85a2e" />
        <StatCard label="Incasso oggi" value={stats ? `€${stats.incassoOggi.toFixed(0)}` : "—"} sub="Tutti i canali" accent="#d4a853" />
        <StatCard label="Pronti" value={stats?.pronti ?? "—"} sub="Da ritirare/consegnare" accent="#4a9e6b" />
        <StatCard label="Online oggi" value={stats?.online ?? "—"} sub="Ordini web" accent="#4a7ec8" />
      </div>

      {/* TABELLA COMPARATIVA SEDI (solo super admin) */}
      {isSuperAdmin && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 700, color: "var(--cream)" }}>
              Confronto sedi — oggi
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4a9e6b", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 11, color: "#4a9e6b" }}>Live · 30s</span>
            </div>
          </div>

          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-high)" }}>
                  {["Sede", "Ordini oggi", "Attivi", "Pronti", "🌐 Online", "📞 Tel.", "🚶 Walk-in", "Incasso oggi", "Stato"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-dim)", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(stats?.sediStats ?? []).map((s: any, i: number) => (
                  <tr key={s.id} style={{ borderTop: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.ordiniAttivi > 0 ? "#4a9e6b" : "var(--border)", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cream)" }}>{s.nome}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)" }}>{s.totaleOrdiniOggi}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: s.ordiniAttivi > 0 ? "#c85a2e" : "var(--text-dim)", fontWeight: s.ordiniAttivi > 0 ? 700 : 400 }}>
                        {s.ordiniAttivi}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: s.pronti > 0 ? "#4a9e6b" : "var(--text-dim)", fontWeight: s.pronti > 0 ? 700 : 400 }}>
                        {s.pronti}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-dim)" }}>{s.canali.online}</td>
                    <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-dim)" }}>{s.canali.telefono}</td>
                    <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-dim)" }}>{s.canali.walk_in}</td>
                    <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 14, color: "#d4a853", fontWeight: 600 }}>
                      €{s.incassoOggi.toFixed(2)}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {s.ordiniAttivi === 0 ? (
                        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>— inattiva</span>
                      ) : (
                        <span style={{ background: "rgba(74,158,107,0.15)", color: "#4a9e6b", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                          ● Attiva
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {/* RIGA TOTALI */}
                {stats?.totali && (
                  <tr style={{ borderTop: "2px solid var(--border)", background: "rgba(212,168,83,0.05)" }}>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "#d4a853" }}>TOTALE</td>
                    <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--cream)" }}>{stats.totali.ordiniOggi}</td>
                    <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "#c85a2e" }}>{stats.ordiniAttivi}</td>
                    <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "#4a9e6b" }}>{stats.pronti}</td>
                    <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--cream)" }}>{stats.totali.online}</td>
                    <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--cream)" }}>{stats.totali.telefono}</td>
                    <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--cream)" }}>{stats.totali.walk_in}</td>
                    <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "#d4a853" }}>
                      €{stats.totali.incasso.toFixed(2)}
                    </td>
                    <td style={{ padding: "12px 14px" }} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BOTTOM GRID */}
      <div style={{ display: "grid", gridTemplateColumns: isSuperAdmin ? "1fr 1fr" : "1fr", gap: 16 }}>

        {/* ORDINI RECENTI */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 700, color: "var(--cream)" }}>Ultimi ordini</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4a9e6b", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 11, color: "#4a9e6b" }}>Live</span>
            </div>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-high)" }}>
                  {["#", ...(isSuperAdmin ? ["Sede"] : []), "Cliente", "Canale", "Stato", "€"].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-dim)", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordiniRecenti.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-dim)", fontSize: 13 }}>Nessun ordine ancora</td></tr>
                ) : ordiniRecenti.map((o) => (
                  <tr key={o.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "9px 12px", fontFamily: "var(--font-mono)", color: "var(--text-dim)", fontSize: 12 }}>#{o.numeroOrdine}</td>
                    {isSuperAdmin && (
                      <td style={{ padding: "9px 12px", fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                        {o.sede?.nome?.replace("Don Basilico ", "") ?? "—"}
                      </td>
                    )}
                    <td style={{ padding: "9px 12px", fontSize: 13 }}>{o.clienteNome || "Anonimo"}</td>
                    <td style={{ padding: "9px 12px", fontSize: 14 }}>{CANALE_ICON[o.canale]}</td>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px",
                        borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: `${STATO_COLOR[o.stato]}20`, color: STATO_COLOR[o.stato],
                      }}>● {o.stato.replace("_", " ")}</span>
                    </td>
                    <td style={{ padding: "9px 12px", fontFamily: "var(--font-mono)", color: "#d4a853", fontSize: 13 }}>
                      €{parseFloat(o.totale).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CANALI MIX (solo admin) */}
        {isSuperAdmin && stats?.totali && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 700, color: "var(--cream)", marginBottom: 16 }}>Mix canali — oggi</h2>

            {[
              { label: "Online", icon: "🌐", val: stats.totali.online, color: "#4a7ec8" },
              { label: "Telefono", icon: "📞", val: stats.totali.telefono, color: "#d4a853" },
              { label: "Walk-in", icon: "🚶", val: stats.totali.walk_in, color: "#c85a2e" },
            ].map((c) => {
              const tot = stats.totali.ordiniOggi || 1;
              const pct = Math.round((c.val / tot) * 100);
              return (
                <div key={c.label} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: "var(--text)" }}>{c.icon} {c.label}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--cream)", fontWeight: 600 }}>
                      {c.val} <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>({pct}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 6, background: "var(--surface-high)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: c.color, borderRadius: 3, transition: "width 0.5s ease" }} />
                  </div>
                </div>
              );
            })}

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Incasso per canale</div>
              {(stats?.sediStats ?? []).map((s: any) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{s.nome}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#d4a853", fontWeight: 600 }}>€{s.incassoOggi.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#d4a853" }}>TOTALE</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: "#d4a853", fontWeight: 700 }}>€{stats.totali.incasso.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
