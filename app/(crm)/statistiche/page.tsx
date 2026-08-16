"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

interface StatsData {
  periodo: { giorni: number; dataInizio: string; dataFine: string };
  graficoDati: Array<{ data: string; ordini: number; incasso: number; online: number; telefono: number; walk_in: number }>;
  topProdotti: Array<{ nome: string; quantita: number }>;
  incassoPerSede: Array<{ nome: string; incasso: number }>;
  riepilogo: {
    totaleOrdini: number;
    incassoTotale: number;
    mediaGiornaliera: number;
    canali: Record<string, number>;
  };
}

function euro(n: number) {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

export default function StatistichePage() {
  const { data: session } = useSession();
  const [data, setData] = useState<StatsData | null>(null);
  const [giorni, setGiorni] = useState(7);
  const [sedi, setSedi] = useState<any[]>([]);
  const [sedeId, setSedeId] = useState("");
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";

  useEffect(() => {
    if (isSuperAdmin) fetch("/api/sedi").then((r) => r.json()).then(setSedi);
  }, [isSuperAdmin]);

  useEffect(() => {
    const sedeParam = sedeId ? `&sedeId=${sedeId}` : (isSuperAdmin ? "" : `&sedeId=${user?.sedeId}`);
    fetch(`/api/statistiche?giorni=${giorni}${sedeParam}`).then((r) => r.json()).then(setData);
  }, [giorni, sedeId, isSuperAdmin, user?.sedeId]);

  const barre = data?.graficoDati ?? [];
  const maxIncasso = Math.max(1, ...barre.map((b) => b.incasso));
  const idxMax = barre.reduce((best, b, i) => (b.incasso > (barre[best]?.incasso ?? -1) ? i : best), 0);

  const topProdotti = data?.topProdotti ?? [];
  const maxQty = topProdotti[0]?.quantita ?? 1;

  const mostraIncassoSede = isSuperAdmin && !sedeId && (data?.incassoPerSede?.length ?? 0) > 1;
  const maxIncassoSede = Math.max(1, ...(data?.incassoPerSede ?? []).map((s) => s.incasso));

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* FILTRI */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[7, 14, 30].map((g) => (
            <button key={g} onClick={() => setGiorni(g)} style={{
              padding: "8px 15px", borderRadius: 20, fontSize: 12.5, cursor: "pointer",
              border: `1px solid ${giorni === g ? "var(--text)" : "var(--border)"}`,
              background: giorni === g ? "var(--text)" : "#fff",
              color: giorni === g ? "#fff" : "var(--text-3)",
              fontFamily: "var(--font-ui)",
            }}>Ultimi {g} giorni</button>
          ))}
        </div>
        {isSuperAdmin && (
          <select value={sedeId} onChange={(e) => setSedeId(e.target.value)} style={{
            background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)",
            padding: "8px 12px", borderRadius: 9, fontSize: 12.5, fontFamily: "var(--font-ui)",
          }}>
            <option value="">Tutte le sedi</option>
            {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        )}
        <button
          onClick={() => toast("Esportazione PDF non ancora configurata")}
          style={{
            marginLeft: "auto", background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)",
            padding: "8px 15px", borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)",
          }}
        >Esporta PDF</button>
      </div>

      {/* ISTOGRAMMA INCASSI */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
        <div style={{ padding: "18px 22px 14px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 500, color: "var(--text)" }}>Incasso giornaliero</h2>
          <span className="num" style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text)" }}>
            {data ? euro(data.riepilogo.incassoTotale) : "—"}
          </span>
        </div>
        <div style={{ padding: "0 22px 22px", display: "flex", alignItems: "flex-end", gap: 8, height: 190 }}>
          {barre.length === 0 ? (
            <div style={{ flex: 1, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Nessun dato</div>
          ) : barre.map((b, i) => {
            const h = Math.max(3, Math.round((b.incasso / maxIncasso) * 150));
            return (
              <div key={b.data} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span className="num" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{b.incasso > 0 ? Math.round(b.incasso) : ""}</span>
                <div style={{
                  width: "100%", maxWidth: 34, height: h, borderRadius: "5px 5px 2px 2px",
                  background: i === idxMax && b.incasso > 0 ? "var(--accent)" : "var(--text)",
                }} />
                <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{b.data}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mostraIncassoSede ? "1fr 1fr" : "1fr", gap: 16 }}>
        {/* TOP PRODOTTI */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 22px 22px" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 500, color: "var(--text)", marginBottom: 16 }}>Più venduti</h3>
          {topProdotti.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 13 }}>Nessun dato</div>
          ) : topProdotti.map((p, i) => (
            <div key={p.nome} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span className="num" style={{ fontSize: 11.5, color: "var(--text-muted)", width: 16, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 13, color: "var(--text)", width: 150, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nome}</span>
              <div style={{ flex: 1, height: 6, background: "var(--border-soft)", borderRadius: 3, overflow: "hidden", maxWidth: 110 }}>
                <div style={{ height: "100%", width: `${Math.round((p.quantita / maxQty) * 100)}%`, background: i === 0 ? "var(--accent)" : "var(--text)", borderRadius: 3 }} />
              </div>
              <span className="num" style={{ fontSize: 12.5, color: "var(--text-2)", marginLeft: "auto", flexShrink: 0 }}>{p.quantita}</span>
            </div>
          ))}
        </div>

        {/* INCASSO PER SEDE */}
        {mostraIncassoSede && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 22px 22px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 500, color: "var(--text)", marginBottom: 16 }}>Incasso per sede</h3>
            {(data?.incassoPerSede ?? []).map((s) => (
              <div key={s.nome} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: "var(--text)", width: 120, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.nome}</span>
                <div style={{ flex: 1, height: 6, background: "var(--border-soft)", borderRadius: 3, overflow: "hidden", maxWidth: 130 }}>
                  <div style={{ height: "100%", width: `${Math.round((s.incasso / maxIncassoSede) * 100)}%`, background: "var(--text)", borderRadius: 3 }} />
                </div>
                <span className="num" style={{ fontSize: 12.5, color: "var(--text-2)", marginLeft: "auto", flexShrink: 0 }}>{euro(s.incasso)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
