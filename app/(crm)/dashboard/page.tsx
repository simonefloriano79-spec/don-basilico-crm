"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const CANALE_GLYPH: Record<string, string> = { online: "◇", telefono: "☏", walk_in: "◧" };
const STATO_LABEL: Record<string, string> = {
  nuovo: "nuovo", confermato: "confermato", in_preparazione: "in preparazione",
  pronto: "pronto", consegnato: "consegnato", annullato: "annullato",
};
const STATO_VAR: Record<string, string> = {
  nuovo: "--stato-nuovo", confermato: "--stato-confermato", in_preparazione: "--stato-in-preparazione",
  pronto: "--stato-pronto", consegnato: "--stato-consegnato", annullato: "--stato-annullato",
};
const STATO_HEX: Record<string, string> = {
  nuovo: "#4a6fa5", confermato: "#b4762a", in_preparazione: "#a05a28",
  pronto: "#4d7c1c", consegnato: "#8a8c80", annullato: "#a8452f",
};

function euro(n: number) {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px 18px" }}>
      <div className="num" style={{ fontSize: 10, letterSpacing: 1.8, textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</div>
      <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 36, letterSpacing: "-1px", color: "var(--text)", marginTop: 10 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 8 }}>{sub}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const sedeParam = searchParams.get("sede") ?? "";

  const [stats, setStats] = useState<any>(null);
  const [ordiniRecenti, setOrdiniRecenti] = useState<any[]>([]);
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";

  useEffect(() => {
    const carica = () => {
      fetch("/api/stats").then((r) => r.json()).then(setStats);
      const qs = new URLSearchParams({ limit: "6" });
      if (isSuperAdmin && sedeParam) qs.set("sedeId", sedeParam);
      fetch(`/api/ordini?${qs}`).then((r) => r.json()).then((d) => setOrdiniRecenti(Array.isArray(d) ? d : []));
    };
    carica();
    const iv = setInterval(carica, 30000);
    return () => clearInterval(iv);
  }, [isSuperAdmin, sedeParam]);

  const vistaSede = isSuperAdmin && sedeParam
    ? (stats?.sediStats ?? []).find((s: any) => s.id === sedeParam)
    : null;

  const ordiniOggi = vistaSede ? vistaSede.totaleOrdiniOggi : stats?.totali?.ordiniOggi ?? 0;
  const ordiniAttivi = vistaSede ? vistaSede.ordiniAttivi : stats?.ordiniAttivi ?? 0;
  const pronti = vistaSede ? vistaSede.pronti : stats?.pronti ?? 0;
  const incasso = vistaSede ? vistaSede.incassoOggi : stats?.incassoOggi ?? 0;
  const ticketMedio = ordiniOggi > 0 ? incasso / ordiniOggi : 0;
  const canaliVista = vistaSede ? vistaSede.canali : stats?.totali
    ? { online: stats.totali.online, telefono: stats.totali.telefono, walk_in: stats.totali.walk_in }
    : null;

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        <KpiCard label="Ordini attivi" value={stats ? String(ordiniAttivi) : "—"} sub="In corso ora" />
        <KpiCard label="Incasso oggi" value={stats ? euro(incasso) : "—"} sub="Tutti i canali" />
        <KpiCard label="Pronti al banco" value={stats ? String(pronti) : "—"} sub="Da ritirare/consegnare" />
        <KpiCard label="Ticket medio" value={stats ? euro(ticketMedio) : "—"} sub="Su ordini di oggi" />
      </div>

      {/* CONFRONTO SEDI */}
      {isSuperAdmin && !sedeParam && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
          <div style={{ padding: "18px 22px 14px" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 500, color: "var(--text)" }}>
              Confronto sedi — oggi
            </h2>
          </div>
          <div style={{ overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-muted)" }}>
                  {["Sede", "Ordini", "Attivi", "Pronti", "Canali", "Incasso", "Stato"].map((h) => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(stats?.sediStats ?? []).map((s: any) => {
                  const pctOnline = s.totaleOrdiniOggi > 0 ? Math.round((s.canali.online / s.totaleOrdiniOggi) * 100) : 0;
                  return (
                    <tr key={s.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.ordiniAttivi > 0 ? "var(--accent)" : "var(--border)", flexShrink: 0 }} />
                          <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{s.nome}</span>
                        </div>
                      </td>
                      <td className="num" style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-2)" }}>{s.totaleOrdiniOggi}</td>
                      <td className="num" style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-2)" }}>{s.ordiniAttivi}</td>
                      <td className="num" style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-2)" }}>{s.pronti}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 90 }}>
                          <div style={{ width: 44, height: 5, borderRadius: 3, background: "var(--border-soft)", overflow: "hidden" }}>
                            <div style={{ width: `${pctOnline}%`, height: "100%", background: "var(--text)" }} />
                          </div>
                          <span className="num" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{pctOnline}% online</span>
                        </div>
                      </td>
                      <td className="num" style={{ padding: "12px 14px", fontSize: 13.5, color: "var(--text)", fontWeight: 500 }}>{euro(s.incassoOggi)}</td>
                      <td style={{ padding: "12px 14px" }}>
                        {s.ordiniAttivi === 0 ? (
                          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>— inattiva</span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: "var(--accent-bg)", color: "var(--accent-ink)" }}>
                            ● Attiva
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {stats?.totali && (
                  <tr style={{ borderTop: "1px solid #dcd9cd", background: "var(--surface-muted)" }}>
                    <td style={{ padding: "12px 14px", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", fontWeight: 500, color: "var(--text-2)" }}>Totale rete</td>
                    <td className="num" style={{ padding: "12px 14px", fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{stats.totali.ordiniOggi}</td>
                    <td className="num" style={{ padding: "12px 14px", fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{stats.ordiniAttivi}</td>
                    <td className="num" style={{ padding: "12px 14px", fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{stats.pronti}</td>
                    <td />
                    <td className="num" style={{ padding: "12px 14px", fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text)" }}>{euro(stats.totali.incasso)}</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RIGA FINALE */}
      <div style={{ display: "grid", gridTemplateColumns: isSuperAdmin ? "1.45fr 1fr" : "1fr", gap: 16 }}>

        {/* ULTIMI ORDINI */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
          <div style={{ padding: "18px 22px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 500, color: "var(--text)" }}>Ultimi ordini</h2>
            <Link href="/ordini" style={{ fontSize: 12, color: "var(--accent-ink)" }}>Vedi tutti →</Link>
          </div>
          <div style={{ padding: "0 22px 6px" }}>
            {ordiniRecenti.length === 0 ? (
              <div style={{ padding: "44px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Nessun ordine ancora</div>
            ) : ordiniRecenti.map((o) => {
              const riepilogo = (o.items ?? []).map((i: any) => `${i.quantita}x ${i.nomeSnapshot}`).join(", ");
              return (
                <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: "1px solid var(--border-soft)" }}>
                  <span className="num" style={{ fontSize: 12.5, color: "var(--text-muted)", width: 34, flexShrink: 0 }}>#{o.numeroOrdine}</span>
                  <span style={{ fontSize: 14, width: 16, flexShrink: 0, textAlign: "center" }}>{CANALE_GLYPH[o.canale]}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{o.clienteNome || o.cliente?.nome || "Anonimo"}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{riepilogo}</div>
                  </div>
                  {isSuperAdmin && (
                    <span style={{ fontSize: 11.5, color: "var(--text-3)", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {o.sede?.nome?.replace("Don Basilico ", "") ?? "—"}
                    </span>
                  )}
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px",
                    borderRadius: 20, fontSize: 11, fontWeight: 500, flexShrink: 0,
                    background: `${STATO_HEX[o.stato]}14`,
                    color: `var(${STATO_VAR[o.stato]})`,
                  }}>
                    {STATO_LABEL[o.stato] ?? o.stato}
                  </span>
                  <span className="num" style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)", width: 70, textAlign: "right", flexShrink: 0 }}>
                    {euro(parseFloat(o.totale))}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ height: 8 }} />
        </div>

        {/* MIX CANALI */}
        {isSuperAdmin && canaliVista && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 22 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 500, color: "var(--text)", marginBottom: 16 }}>Mix canali — oggi</h2>

            {[
              { label: "Online", val: canaliVista.online, color: "var(--text)" },
              { label: "Telefono", val: canaliVista.telefono, color: "var(--accent)" },
              { label: "Walk-in", val: canaliVista.walk_in, color: "#c9c6ba" },
            ].map((c) => {
              const tot = ordiniOggi || 1;
              const pct = Math.round((c.val / tot) * 100);
              return (
                <div key={c.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: "var(--text-2)" }}>{c.label}</span>
                    <span className="num" style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>
                      {c.val} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({pct}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 6, background: "var(--border-soft)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: c.color, borderRadius: 3, transition: "width .5s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
