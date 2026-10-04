"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { stampaSilenziosa } from "@/lib/print";
import { ordineApiPerStampa } from "@/lib/ordine-utils";

const CHIAVE_ON = "db_autostampa_on";
const CHIAVE_SEDE = "db_autostampa_sede";

// Stampa automatica delle comande: da attivare SOLO sul PC collegato alla stampante. Ogni pochi secondi cerca gli
// ordini mai stampati della sede (presi da telefono/tablet, o accettati dal sito online) e li stampa. L'impostazione
// resta salvata su questo dispositivo (localStorage), per sede.
export function AutoStampa({ sedeId: sedeUtente, isSuperAdmin }: { sedeId?: string | null; isSuperAdmin: boolean }) {
  const [attiva, setAttiva] = useState(false);
  const [sedi, setSedi] = useState<{ id: string; nome: string }[]>([]);
  const [sedeScelta, setSedeScelta] = useState("");
  const [info, setInfo] = useState(false);
  const inCorso = useRef(false);

  useEffect(() => {
    try {
      setAttiva(localStorage.getItem(CHIAVE_ON) === "1");
      setSedeScelta(localStorage.getItem(CHIAVE_SEDE) ?? "");
    } catch {}
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch("/api/sedi").then((r) => r.json()).then((d) => Array.isArray(d) && setSedi(d.map((s: any) => ({ id: s.id, nome: s.nome })))).catch(() => {});
  }, [isSuperAdmin]);

  const sedeId = isSuperAdmin ? sedeScelta : sedeUtente ?? "";

  const imposta = (v: boolean) => {
    setAttiva(v);
    try { localStorage.setItem(CHIAVE_ON, v ? "1" : "0"); } catch {}
  };

  useEffect(() => {
    if (!attiva || !sedeId) return;
    let fermo = false;

    const giro = async () => {
      if (inCorso.current) return;
      inCorso.current = true;
      try {
        const r = await fetch(`/api/ordini/da-stampare?sedeId=${sedeId}`);
        if (!r.ok) return;
        const lista = await r.json();
        for (const o of Array.isArray(lista) ? lista : []) {
          if (fermo) break;
          const c = await fetch(`/api/ordini/${o.id}/stampa-claim`, { method: "POST" }).then((x) => x.json()).catch(() => null);
          if (!c?.claimed) continue; // già presa da un'altra schermata
          try {
            await stampaSilenziosa(ordineApiPerStampa(o));
            toast.success(`Stampata comanda #${o.numeroOrdine}`);
          } catch {
            toast.error(`Stampa della comanda #${o.numeroOrdine} non riuscita`);
          }
          await new Promise((res) => setTimeout(res, 1500));
        }
      } finally {
        inCorso.current = false;
      }
    };

    giro();
    const iv = setInterval(giro, 8000);
    return () => { fermo = true; clearInterval(iv); };
  }, [attiva, sedeId]);

  return (
    <div style={{ margin: "0 12px 10px", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: attiva ? "var(--accent-bg-2)" : "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)", flex: 1 }}>🖨 Stampa automatica</span>
        <button
          onClick={() => {
            if (!attiva && !sedeId) return toast.error("Scegli prima la sede");
            imposta(!attiva);
          }}
          style={{
            border: "none", borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
            background: attiva ? "var(--text)" : "var(--border)", color: attiva ? "#fff" : "var(--text-2)", fontFamily: "var(--font-ui)",
          }}
        >{attiva ? "ON" : "OFF"}</button>
      </div>
      {isSuperAdmin && (
        <select
          value={sedeScelta}
          onChange={(e) => { setSedeScelta(e.target.value); try { localStorage.setItem(CHIAVE_SEDE, e.target.value); } catch {} }}
          style={{ marginTop: 8, width: "100%", fontSize: 11.5, padding: "5px 6px", borderRadius: 6, border: "1px solid var(--border)", fontFamily: "var(--font-ui)" }}
        >
          <option value="">Sede da stampare…</option>
          {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      )}
      <button onClick={() => setInfo(!info)} style={{ marginTop: 6, background: "none", border: "none", padding: 0, fontSize: 11, color: "var(--text-muted)", cursor: "pointer", textDecoration: "underline" }}>
        {attiva ? "Attiva su questo PC (quello con la stampante)" : "Cos'è?"}
      </button>
      {info && (
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.45 }}>
          Accendila solo sul PC collegato alla stampante: stampa da sola le comande degli ordini presi da telefono o tablet e quelli del sito online appena accettati.
          Per non vedere la finestra di stampa, avvia Chrome/Edge con l'opzione <code>--kiosk-printing</code>.
        </div>
      )}
    </div>
  );
}
