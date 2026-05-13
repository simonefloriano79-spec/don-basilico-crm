"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS_CANALE = ["#4a7ec8", "#d4a853", "#c85a2e"];

interface StatsData {
  periodo: { giorni: number; dataInizio: string; dataFine: string };
  graficoDati: Array<{ data: string; ordini: number; incasso: number; online: number; telefono: number; walk_in: number }>;
  topProdotti: Array<{ nome: string; quantita: number }>;
  riepilogo: {
    totaleOrdini: number;
    incassoTotale: number;
    mediaGiornaliera: number;
    canali: Record<string, number>;
  };
}

const tooltipStyle = {
  contentStyle: {
    background: "#2e2820", border: "1px solid #3d3428",
    borderRadius: 8, color: "#f0e6d3", fontSize: 12,
    fontFamily: "var(--font-sans)",
  },
  labelStyle: { color: "#c9b99a" },
};

export default function StatistichePage() {
  const { data: session } = useSession();
  const [data, setData] = useState<StatsData | null>(null);
  const [giorni, setGiorni] = useState(7);
  const [sedi, setSedi] = useState<any[]>([]);
  const [sedeId, setSedeId] = useState("");
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";

  useEffect(() => {
    if (isSuperAdmin) {
      fetch("/api/sedi").then((r) => r.json()).then(setSedi);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    const sedeParam = sedeId ? `&sedeId=${sedeId}` : (isSuperAdmin ? "" : `&sedeId=${user?.sedeId}`);
    fetch(`/api/statistiche?giorni=${giorni}${sedeParam}`)
      .then((r) => r.json())
      .then(setData);
  }, [giorni, sedeId, isSuperAdmin, user?.sedeId]);

  const canaliPie = data ? [
    { name: "Online", value: data.riepilogo.canali.online ?? 0 },
    { name: "Telefono", value: data.riepilogo.canali.telefono ?? 0 },
    { name: "Walk-in", value: data.riepilogo.canali.walk_in ?? 0 },
  ] : [];

  return (
    <div className="animate-in">
      {/* FILTRI */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[7, 14, 30].map((g) => (
            <button key={g} onClick={() => setGiorni(g)} style={{
              padding: "6px 16px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: `1px solid ${giorni === g ? "var(--terracotta)" : "var(--border)"}`,
              background: giorni === g ? "rgba(200,90,46,0.15)" : "transparent",
              color: giorni === g ? "var(--terracotta)" : "var(--text-dim)",
              fontFamily: "var(--font-sans)",
            }}>
              Ultimi {g} giorni
            </button>
          ))}
        </div>
        {isSuperAdmin && (
          <select
            value={sedeId}
            onChange={(e) => setSedeId(e.target.value)}
            style={{
              background: "var(--surface-high)", border: "1px solid var(--border)",
              color: "var(--text)", padding: "6px 12px", borderRadius: 8, fontSize: 13,
              fontFamily: "var(--font-sans)",
            }}
          >
            <option value="">Tutte le sedi</option>
            {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        )}
        {data && (
          <span style={{ fontSize: 12, color: "var(--text-dim)", marginLeft: "auto" }}>
            {data.periodo.dataInizio} → {data.periodo.dataFine}
          </span>
        )}
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Ordini periodo", value: data?.riepilogo.totaleOrdini ?? "—", accent: "#c85a2e" },
          { label: "Incasso totale", value: data ? `€${data.riepilogo.incassoTotale.toFixed(2)}` : "—", accent: "#d4a853" },
          { label: "Media giornaliera", value: data ? `€${data.riepilogo.mediaGiornaliera.toFixed(2)}` : "—", accent: "#4a9e6b" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
            padding: 20, position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: s.accent }} />
            <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--cream)" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* GRAFICO INCASSO */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 700, color: "var(--cream)", marginBottom: 16 }}>
            Incasso giornaliero
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.graficoDati ?? []} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3d3428" />
              <XAxis dataKey="data" tick={{ fill: "#8a7a65", fontSize: 10 }} />
              <YAxis tick={{ fill: "#8a7a65", fontSize: 10 }} tickFormatter={(v) => `€${v}`} />
              <Tooltip {...tooltipStyle} formatter={(v: any) => [`€${Number(v).toFixed(2)}`, "Incasso"]} />
              <Bar dataKey="incasso" fill="#d4a853" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* GRAFICO ORDINI */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 700, color: "var(--cream)", marginBottom: 16 }}>
            Ordini per canale
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data?.graficoDati ?? []} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3d3428" />
              <XAxis dataKey="data" tick={{ fill: "#8a7a65", fontSize: 10 }} />
              <YAxis tick={{ fill: "#8a7a65", fontSize: 10 }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8a7a65" }} />
              <Line type="monotone" dataKey="online"   name="Online"   stroke="#4a7ec8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="telefono" name="Telefono" stroke="#d4a853" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="walk_in"  name="Walk-in"  stroke="#c85a2e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* TOP PRODOTTI */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 700, color: "var(--cream)", marginBottom: 16 }}>
            🏆 Top 10 prodotti
          </h3>
          {(data?.topProdotti ?? []).length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--text-dim)", fontSize: 13 }}>Nessun dato</div>
          ) : (data?.topProdotti ?? []).map((p, i) => {
            const max = data?.topProdotti[0]?.quantita ?? 1;
            const pct = Math.round((p.quantita / max) * 100);
            return (
              <div key={p.nome} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--text)", display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", minWidth: 18 }}>{i + 1}.</span>
                    {p.nome}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--cream)", fontWeight: 600 }}>{p.quantita}</span>
                </div>
                <div style={{ height: 4, background: "var(--surface-high)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${pct}%`,
                    background: i === 0 ? "#d4a853" : i < 3 ? "#c85a2e" : "#4a7ec8",
                    borderRadius: 2, transition: "width 0.4s ease",
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* PIE CANALI */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 700, color: "var(--cream)", marginBottom: 16 }}>
            Mix canali
          </h3>
          {canaliPie.every((c) => c.value === 0) ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--text-dim)", fontSize: 13 }}>Nessun dato</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={canaliPie}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {canaliPie.map((_, i) => (
                    <Cell key={i} fill={COLORS_CANALE[i]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8 }}>
            {canaliPie.map((c, i) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS_CANALE[i] }} />
                <span style={{ color: "var(--text-dim)" }}>{c.name}: </span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--cream)" }}>{c.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
