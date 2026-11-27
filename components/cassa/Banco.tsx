"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { NESSUN_TRANCIO, TRANCI, descriviBanco, pezziBanco, totaleBanco, type Quantita } from "@/lib/banco";

// Vendita al banco: tocchi i tranci e «Incassa». Niente nome, orario o stampa; non crea ordini.

const euro = (n: number) => `€ ${n.toFixed(2).replace(".", ",")}`;
const ora = (d: string) => new Date(d).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
const tondo: React.CSSProperties = { width: 38, height: 38, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", color: "var(--text)", fontSize: 19, cursor: "pointer" };

export default function Banco({ sedeId, scelta }: { sedeId: string; scelta: React.ReactNode }) {
  const [q, setQ] = useState<Quantita>(NESSUN_TRANCIO);
  const [vendite, setVendite] = useState<any[]>([]);
  const [invio, setInvio] = useState(false);

  const carica = useCallback(async () => {
    const res = await fetch(`/api/banco?sedeId=${sedeId}`).catch(() => null);
    if (res?.ok) setVendite(await res.json());
  }, [sedeId]);

  useEffect(() => { setQ(NESSUN_TRANCIO); setVendite([]); carica(); }, [carica]);

  const cambia = (id: keyof Quantita, di: number) => setQ((p) => ({ ...p, [id]: Math.max(0, p[id] + di) }));
  const totale = totaleBanco(q);
  const pezzi = pezziBanco(q);

  const incassa = async () => {
    if (!pezzi || invio) return;
    setInvio(true);
    const res = await fetch("/api/banco", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sedeId, ...q }) }).catch(() => null);
    setInvio(false);
    if (!res?.ok) return toast.error((await res?.json().catch(() => null))?.error ?? "Non riesco a registrare la vendita", { duration: 8000 });
    toast.success(`Incassati ${euro(totale)}`);
    setQ(NESSUN_TRANCIO);
    carica();
  };

  const annulla = async (v: any) => {
    if (!confirm(`Annullare la vendita delle ${ora(v.createdAt)} (${euro(v.totale)})?`)) return;
    const res = await fetch("/api/banco", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: v.id }) }).catch(() => null);
    if (res?.ok) toast.success("Vendita annullata");
    else toast.error("Non riesco ad annullare la vendita");
    carica();
  };

  const incassoSerata = vendite.reduce((a, v) => a + v.totale, 0);

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 300px", minWidth: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
        {TRANCI.map((t) => (
          <button key={t.id} onClick={() => cambia(t.id, 1)} style={{
            position: "relative", textAlign: "left", background: "#fff", border: `1px solid ${q[t.id] ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 12, padding: "22px 16px", minHeight: 130, cursor: "pointer", userSelect: "none", fontFamily: "var(--font-ui)",
          }}>
            {q[t.id] > 0 && (
              <span className="num" style={{ position: "absolute", top: 10, right: 10, background: "var(--text)", color: "#fff", minWidth: 24, height: 24, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{q[t.id]}</span>
            )}
            <div style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text)", paddingRight: 26 }}>{t.nome}</div>
            <div className="num" style={{ fontSize: 18, color: "var(--text)", marginTop: 10 }}>{euro(t.prezzo)}</div>
          </button>
        ))}
      </div>

      <div style={{ width: 352, maxWidth: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-soft)" }}>{scelta}</div>
        <div style={{ padding: "14px 20px" }}>
          {!pezzi ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-faint)", fontSize: 13 }}>Tocca un trancio per iniziare</div>
          ) : TRANCI.filter((t) => q[t.id] > 0).map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{t.nome}</div>
              <button aria-label={`Togli ${t.nome}`} onClick={() => cambia(t.id, -1)} style={tondo}>−</button>
              <span className="num" style={{ fontSize: 15, minWidth: 20, textAlign: "center" }}>{q[t.id]}</span>
              <button aria-label={`Aggiungi ${t.nome}`} onClick={() => cambia(t.id, 1)} style={tondo}>+</button>
              <span className="num" style={{ fontSize: 13, fontWeight: 500, minWidth: 56, textAlign: "right" }}>{euro(q[t.id] * t.prezzo)}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border-soft)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Totale</span>
            <span className="num" style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--text)" }}>{euro(totale)}</span>
          </div>
          <button onClick={incassa} disabled={!pezzi || invio} style={{
            width: "100%", border: "none", padding: 16, borderRadius: 9, fontSize: 15, fontWeight: 600, fontFamily: "var(--font-ui)",
            cursor: pezzi ? "pointer" : "default", background: pezzi ? "var(--text)" : "var(--border)", color: pezzi ? "#fff" : "var(--text-faint)",
          }}>{invio ? "Registro…" : "Incassa"}</button>
        </div>
        {vendite.length > 0 && (
          <div style={{ padding: "12px 20px 14px", borderTop: "1px solid var(--border-soft)" }}>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 6 }}>
              Al banco stasera: <strong className="num">{euro(incassoSerata)}</strong> ({vendite.length} {vendite.length === 1 ? "vendita" : "vendite"})
            </div>
            {vendite.slice(0, 5).map((v) => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: "1px solid var(--border-soft)", fontSize: 12 }}>
                <span className="num" style={{ color: "var(--text-muted)" }}>{ora(v.createdAt)}</span>
                <span style={{ flex: 1, minWidth: 0, color: "var(--text-2)" }}>{descriviBanco(v)}</span>
                <span className="num" style={{ fontWeight: 600 }}>{euro(v.totale)}</span>
                <button onClick={() => annulla(v)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 11.5, cursor: "pointer", fontFamily: "var(--font-ui)", padding: "4px 2px" }}>Annulla</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
