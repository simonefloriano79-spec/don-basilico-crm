"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { stampaBrowser } from "@/lib/print";

const STATI_FLOW = ["nuovo", "confermato", "in_preparazione", "pronto", "consegnato"];
const STATO_LABEL: Record<string, string> = {
  nuovo: "nuovo", confermato: "confermato", in_preparazione: "in preparazione",
  pronto: "pronto", consegnato: "consegnato", annullato: "annullato",
};
const STATO_HEX: Record<string, string> = {
  nuovo: "#4a6fa5", confermato: "#b4762a", in_preparazione: "#a05a28",
  pronto: "#4d7c1c", consegnato: "#8a8c80", annullato: "#a8452f",
};
const CANALE_LABEL: Record<string, string> = { online: "online", telefono: "telefono", walk_in: "walk-in" };
const AZIONE_LABEL: Record<string, string> = {
  nuovo: "Conferma ordine", confermato: "Inizia preparazione",
  in_preparazione: "Segna pronto", pronto: "Segna consegnato",
};

function euro(n: number) {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

function ora(d: string) {
  return new Date(d).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export default function OrdiniPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const sedeParam = searchParams.get("sede") ?? "";
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";

  const [ordini, setOrdini] = useState<any[]>([]);
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [ricerca, setRicerca] = useState("");
  const [selezionato, setSelezionato] = useState<any>(null);

  const caricaOrdini = useCallback(async () => {
    const qs = new URLSearchParams({ limit: "80" });
    if (isSuperAdmin && sedeParam) qs.set("sedeId", sedeParam);
    const res = await fetch(`/api/ordini?${qs}`);
    const data = await res.json();
    setOrdini(Array.isArray(data) ? data : []);
  }, [isSuperAdmin, sedeParam]);

  useEffect(() => { caricaOrdini(); }, [caricaOrdini]);

  const caricaDettaglio = useCallback(async (id: string) => {
    const res = await fetch(`/api/ordini/${id}`);
    if (res.ok) setSelezionato(await res.json());
  }, []);

  useEffect(() => {
    if (!selezionato) return;
    const iv = setInterval(() => caricaDettaglio(selezionato.id), 15000);
    return () => clearInterval(iv);
  }, [selezionato?.id, caricaDettaglio]);

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
      toast.success(`Stato → ${STATO_LABEL[newStato]}`);
      caricaOrdini();
      caricaDettaglio(ordine.id);
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
      caricaDettaglio(ordine.id);
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
      ora: ora(ordine.createdAt),
    });
    await fetch(`/api/ordini/${ordine.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stampato: true }) });
    caricaOrdini();
  };

  const visibili = ordini.filter((o) => {
    if (filtroStato === "attivi" && ["consegnato", "annullato"].includes(o.stato)) return false;
    if (STATI_FLOW.includes(filtroStato) && o.stato !== filtroStato) return false;
    if (ricerca.trim()) {
      const q = ricerca.trim().toLowerCase();
      const match = String(o.numeroOrdine).includes(q)
        || (o.clienteNome ?? "").toLowerCase().includes(q)
        || (o.clienteTelefono ?? "").includes(q);
      if (!match) return false;
    }
    return true;
  });

  const chipStyle = (attivo: boolean, hex?: string) => ({
    padding: "8px 15px", borderRadius: 20, fontSize: 12.5, cursor: "pointer",
    border: `1px solid ${attivo ? "var(--text)" : "var(--border)"}`,
    background: attivo ? "var(--text)" : "#fff",
    color: attivo ? "#fff" : "var(--text-3)",
    fontFamily: "var(--font-ui)", whiteSpace: "nowrap", flexShrink: 0,
  } as React.CSSProperties);

  return (
    <div className="animate-in" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Filtri */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setFiltroStato("tutti")} style={chipStyle(filtroStato === "tutti")}>Tutti</button>
            <button onClick={() => setFiltroStato("attivi")} style={chipStyle(filtroStato === "attivi")}>Attivi</button>
            {STATI_FLOW.map((s) => (
              <button key={s} onClick={() => setFiltroStato(s)} style={chipStyle(filtroStato === s)}>{STATO_LABEL[s]}</button>
            ))}
          </div>
          <div style={{ position: "relative", marginLeft: "auto", width: 300, flexShrink: 0 }}>
            <span style={{ position: "absolute", left: 12, top: 9, color: "var(--text-faint)", fontSize: 13 }}>⌕</span>
            <input
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              placeholder="Cerca ordine, cliente, telefono…"
              style={{
                width: "100%", padding: "9px 12px 9px 34px", border: "1px solid var(--border)",
                borderRadius: 9, fontSize: 12.5, background: "#fff", outline: "none", fontFamily: "var(--font-ui)",
              }}
            />
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-muted)" }}>
                {["Ordine", "Ora", "Cliente", "Canale", ...(isSuperAdmin ? ["Sede"] : []), "Stato", "Totale"].map((h) => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibili.length === 0 ? (
                <tr><td colSpan={isSuperAdmin ? 7 : 6} style={{ textAlign: "center", padding: 44, color: "var(--text-muted)", fontSize: 13 }}>Nessun ordine con questi filtri</td></tr>
              ) : visibili.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => caricaDettaglio(o.id)}
                  style={{
                    borderTop: "1px solid var(--border-soft)", cursor: "pointer",
                    background: selezionato?.id === o.id ? "var(--surface-muted)" : "transparent",
                  }}
                >
                  <td className="num" style={{ padding: "13px 14px", fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>#{o.numeroOrdine}</td>
                  <td className="num" style={{ padding: "13px 14px", fontSize: 12.5, color: "var(--text-3)" }}>{ora(o.createdAt)}</td>
                  <td style={{ padding: "13px 14px" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{o.clienteNome || "Anonimo"}</div>
                    {o.clienteTelefono && <div className="num" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{o.clienteTelefono}</div>}
                  </td>
                  <td style={{ padding: "13px 14px", fontSize: 12.5, color: "var(--text-3)" }}>{CANALE_LABEL[o.canale]}</td>
                  {isSuperAdmin && <td style={{ padding: "13px 14px", fontSize: 12.5, color: "var(--text-3)", whiteSpace: "nowrap" }}>{o.sede?.nome?.replace("Don Basilico ", "") ?? "—"}</td>}
                  <td style={{ padding: "13px 14px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px",
                      borderRadius: 20, fontSize: 11, fontWeight: 500,
                      background: `${STATO_HEX[o.stato]}14`, color: STATO_HEX[o.stato],
                    }}>{STATO_LABEL[o.stato]}</span>
                  </td>
                  <td className="num" style={{ padding: "13px 14px", fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{euro(parseFloat(o.totale))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PANNELLO DETTAGLIO */}
      {selezionato && (
        <div style={{
          width: 352, flexShrink: 0, position: "sticky", top: 0,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
        }}>
          <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Ordine</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text)" }}>#{selezionato.numeroOrdine}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {selezionato.clienteNome || "Anonimo"} · {ora(selezionato.createdAt)}
              </div>
            </div>
            <button onClick={() => setSelezionato(null)} style={{
              width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border)",
              background: "#fff", cursor: "pointer", fontSize: 13, color: "var(--text-3)",
            }}>✕</button>
          </div>

          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-soft)" }}>
            {(selezionato.items ?? []).map((i: any) => (
              <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                <div>
                  <span className="num" style={{ fontSize: 13, color: "var(--text-2)" }}>{i.quantita}× </span>
                  <span style={{ fontSize: 13, color: "var(--text)" }}>{i.nomeSnapshot}</span>
                  {i.noteItem && <div style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 2 }}>{i.noteItem}</div>}
                </div>
                <span className="num" style={{ fontSize: 13, color: "var(--text-2)", flexShrink: 0 }}>{euro(parseFloat(i.prezzoSnapshot) * i.quantita)}</span>
              </div>
            ))}
            {selezionato.note && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>Nota: {selezionato.note}</div>}
            {parseFloat(selezionato.costoConsegna ?? 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Consegna</span>
                <span className="num" style={{ fontSize: 12.5, color: "var(--text-2)" }}>{euro(parseFloat(selezionato.costoConsegna))}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-soft)" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>Totale</span>
              <span className="num" style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--text)" }}>{euro(parseFloat(selezionato.totale))}</span>
            </div>
          </div>

          {selezionato.stato !== "annullato" && (
            <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-soft)" }}>
              <div style={{ fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>Avanzamento</div>
              {STATI_FLOW.map((s) => {
                const idxAttuale = STATI_FLOW.indexOf(selezionato.stato);
                const idxStep = STATI_FLOW.indexOf(s);
                const raggiunto = idxStep <= idxAttuale;
                const log = (selezionato.statiLog ?? []).find((l: any) => l.stato === s);
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: raggiunto ? "var(--accent)" : "var(--border)", flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: raggiunto ? "var(--text)" : "var(--text-muted)", flex: 1 }}>{STATO_LABEL[s]}</span>
                    {log && <span className="num" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{ora(log.createdAt)}</span>}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 8 }}>
            {AZIONE_LABEL[selezionato.stato] && (
              <button onClick={() => avanzaStato(selezionato)} style={{
                background: "var(--text)", color: "#fff", border: "none", padding: "10px 18px",
                borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)",
              }}>{AZIONE_LABEL[selezionato.stato]}</button>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => gestisciStampa(selezionato)} style={{
                flex: 1, background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)",
                padding: "9px 12px", borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)",
              }}>Stampa</button>
              {selezionato.clienteTelefono && (
                <a href={`tel:${selezionato.clienteTelefono}`} style={{
                  flex: 1, background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)",
                  padding: "9px 12px", borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)",
                  textAlign: "center", textDecoration: "none", display: "block",
                }}>Chiama cliente</a>
              )}
            </div>
            {!["consegnato", "annullato"].includes(selezionato.stato) && (
              <button onClick={() => annullaOrdine(selezionato)} style={{
                background: "transparent", border: "none", color: "var(--danger)",
                fontSize: 11.5, cursor: "pointer", fontFamily: "var(--font-ui)", padding: "4px 0",
              }}>Annulla ordine</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
