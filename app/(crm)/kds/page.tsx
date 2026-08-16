"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { stampaBrowser } from "@/lib/print";

const STATI_FLOW = ["nuovo", "confermato", "in_preparazione", "pronto", "consegnato"];
const STATO_LABEL: Record<string, string> = { nuovo: "nuovo", confermato: "confermato", in_preparazione: "in preparazione" };
const NEXT_LABEL: Record<string, string> = { nuovo: "Conferma", confermato: "Inizia preparazione", in_preparazione: "Segna pronto" };
const CANALE_LABEL: Record<string, string> = { online: "online", telefono: "telefono", walk_in: "walk-in" };

function minutiTrascorsi(createdAt: string) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

export default function KDSPage() {
  const { data: session } = useSession();
  const [ordini, setOrdini] = useState<any[]>([]);
  const [, forceTick] = useState(0);
  const user = session?.user as any;

  const carica = useCallback(async () => {
    const sedeParam = user?.ruolo !== "super_admin" && user?.sedeId ? `&sedeId=${user.sedeId}` : "";
    const res = await fetch(`/api/ordini?limit=100${sedeParam}`);
    const all = await res.json();
    setOrdini((Array.isArray(all) ? all : []).filter((o: any) => ["nuovo", "confermato", "in_preparazione"].includes(o.stato)));
  }, [user]);

  useEffect(() => { carica(); const iv = setInterval(carica, 15000); return () => clearInterval(iv); }, [carica]);
  useEffect(() => { const iv = setInterval(() => forceTick((t) => t + 1), 30000); return () => clearInterval(iv); }, []);

  const avanza = async (ordine: any) => {
    const idx = STATI_FLOW.indexOf(ordine.stato);
    if (idx >= STATI_FLOW.length - 1) return;
    const newStato = STATI_FLOW[idx + 1];
    const res = await fetch(`/api/ordini/${ordine.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stato: newStato }) });
    if (res.ok) { if (newStato === "pronto") toast.success(`#${ordine.numeroOrdine} pronto`); carica(); }
  };

  const annulla = async (ordine: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Annullare l'ordine #${ordine.numeroOrdine}?`)) return;
    const res = await fetch(`/api/ordini/${ordine.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stato: "annullato" }) });
    if (res.ok) { toast.success(`#${ordine.numeroOrdine} annullato`); carica(); }
  };

  const stampa = async (ordine: any, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const inForno = ordini.filter((o) => o.stato === "in_preparazione").length;
  const attesaMedia = ordini.length ? Math.round(ordini.reduce((a, o) => a + minutiTrascorsi(o.createdAt), 0) / ordini.length) : 0;
  const oltre15 = ordini.filter((o) => minutiTrascorsi(o.createdAt) > 15).length;

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* BARRA SCURA */}
      <div style={{ background: "var(--text)", borderRadius: 14, padding: "16px 22px", display: "flex", alignItems: "center", color: "#f4f3ee" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ padding: "0 22px 0 0" }}>
            <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "#f4f3ee" }}>{inForno}</div>
            <div style={{ fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", color: "#a8aa9c", marginTop: 2 }}>In forno adesso</div>
          </div>
          <div style={{ width: 1, height: 34, background: "#33352c" }} />
          <div style={{ padding: "0 22px" }}>
            <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "#f4f3ee" }}>{attesaMedia}<span style={{ fontSize: 15 }}> min</span></div>
            <div style={{ fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", color: "#a8aa9c", marginTop: 2 }}>Attesa media</div>
          </div>
          <div style={{ width: 1, height: 34, background: "#33352c" }} />
          <div style={{ padding: "0 22px" }}>
            <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 28, color: oltre15 > 0 ? "#e8a17f" : "#f4f3ee" }}>{oltre15}</div>
            <div style={{ fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", color: "#a8aa9c", marginTop: 2 }}>Oltre 15 min</div>
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 12.5, color: "#f4f3ee" }}>{user?.sedeNome ?? "Tutte le sedi"}</div>
          <div style={{ fontSize: 11, color: "#a8aa9c", marginTop: 2 }}>tocca la card per avanzare</div>
        </div>
      </div>

      {ordini.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 15 }}>Nessun ordine in lavorazione</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 14 }}>
          {ordini.map((ordine) => {
            const min = minutiTrascorsi(ordine.createdAt);
            const inRitardo = min > 15;
            const inPrep = ordine.stato === "in_preparazione";
            return (
              <div key={ordine.id} style={{
                background: "var(--surface)", border: `1px solid ${inRitardo ? "var(--danger-border)" : "var(--border)"}`,
                borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column",
              }}>
                <div style={{ padding: "14px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text)" }}>#{ordine.numeroOrdine}</div>
                    <span className="num" style={{
                      display: "inline-block", marginTop: 4, fontSize: 11, padding: "2px 8px", borderRadius: 20,
                      background: inRitardo ? "var(--danger-bg)" : "var(--surface-muted)",
                      color: inRitardo ? "var(--danger)" : "var(--text-muted)",
                    }}>{min} min</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{CANALE_LABEL[ordine.canale]}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "capitalize", marginTop: 2 }}>{ordine.tipo}</div>
                  </div>
                </div>

                <div style={{ padding: "0 16px 12px", flex: 1 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                    {ordine.clienteNome || "Anonimo"}{ordine.clienteTelefono && ` · ${ordine.clienteTelefono}`}
                  </div>
                  {(ordine.items ?? []).map((item: any, i: number) => (
                    <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderTop: i > 0 ? "1px solid var(--border-faint)" : "none" }}>
                      <span className="num" style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text)", minWidth: 26 }}>{item.quantita}×</span>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{item.nomeSnapshot}</div>
                        {item.noteItem && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 2 }}>{item.noteItem}</div>}
                      </div>
                    </div>
                  ))}
                  {ordine.note && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--danger)" }}>{ordine.note}</div>
                  )}
                  <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                    {!ordine.stampato && (
                      <button onClick={(e) => stampa(ordine, e)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", padding: 0, fontFamily: "var(--font-ui)" }}>Stampa</button>
                    )}
                    <button onClick={(e) => annulla(ordine, e)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 11, cursor: "pointer", padding: 0, fontFamily: "var(--font-ui)" }}>Annulla</button>
                  </div>
                </div>

                <div
                  onClick={() => avanza(ordine)}
                  style={{
                    padding: "12px 16px", textAlign: "center", cursor: "pointer", fontSize: 13, fontWeight: 500,
                    background: inPrep ? "var(--text)" : "var(--bg)",
                    color: inPrep ? "#fff" : "var(--text-2)",
                  }}
                >
                  {NEXT_LABEL[ordine.stato]} →
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
