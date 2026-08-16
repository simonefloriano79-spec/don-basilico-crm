"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

const POLL_MS = 8000;

interface ArticoloVocale {
  nomeSnapshot: string;
  taglia: "normale" | "maxi";
  prezzoSnapshot: number;
  quantita: number;
  extra: { nome: string; prezzo: number }[];
  note: string | null;
}

interface OrdineVocale {
  id: string;
  numeroOrdine: number;
  sede: { nome: string };
  clienteNome: string;
  clienteTelefono: string;
  tipo: "domicilio" | "asporto";
  clienteIndirizzo: string | null;
  articoli: ArticoloVocale[];
  totale: string;
  note: string | null;
  oraRichiesta: string;
  stato: "nuovo" | "preso_in_carico" | "annullato";
  createdAt: string;
}

export default function SchermoCassaPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";

  const [ordini, setOrdini] = useState<OrdineVocale[]>([]);
  const contiPrecedenti = useRef<Set<string>>(new Set());

  const carica = useCallback(async () => {
    const res = await fetch("/api/ordini-vocali");
    if (!res.ok) return;
    const data: OrdineVocale[] = await res.json();

    // Notifica sonora/toast per ordini nuovi mai visti in questa sessione dello schermo
    const idAttuali = new Set(data.map((o) => o.id));
    data.forEach((o) => {
      if (o.stato === "nuovo" && !contiPrecedenti.current.has(o.id) && contiPrecedenti.current.size > 0) {
        toast.success(`Nuovo ordine vocale #${o.numeroOrdine}!`, { duration: 4000, icon: "📞" });
      }
    });
    contiPrecedenti.current = idAttuali;

    setOrdini(data);
  }, []);

  useEffect(() => {
    carica();
    const iv = setInterval(carica, POLL_MS);
    return () => clearInterval(iv);
  }, [carica]);

  const aggiornaStato = async (id: string, stato: "preso_in_carico" | "annullato") => {
    const res = await fetch(`/api/ordini-vocali/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stato }),
    });
    if (res.ok) {
      toast.success(stato === "preso_in_carico" ? "Ordine preso in carico" : "Ordine annullato");
      carica();
    } else {
      toast.error("Errore aggiornamento ordine");
    }
  };

  const nuovi = ordini.filter((o) => o.stato === "nuovo");
  const presiInCarico = ordini.filter((o) => o.stato === "preso_in_carico");

  return (
    <div className="animate-in">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4a9e6b", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 13, color: "#4a9e6b" }}>Live · aggiornamento ogni 8s</span>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>
          {nuovi.length} nuovi · {presiInCarico.length} in carico
        </span>
      </div>

      {nuovi.length === 0 && presiInCarico.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 56, marginBottom: 12, opacity: 0.3 }}>📞</div>
          <div style={{ fontSize: 16, color: "var(--text-muted)" }}>Nessun ordine vocale in arrivo</div>
        </div>
      ) : (
        <>
          {nuovi.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, marginBottom: 24 }}>
              {nuovi.map((o) => (
                <CardOrdine key={o.id} ordine={o} isSuperAdmin={isSuperAdmin} onAggiorna={aggiornaStato} />
              ))}
            </div>
          )}

          {presiInCarico.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                Presi in carico
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, opacity: 0.6 }}>
                {presiInCarico.map((o) => (
                  <CardOrdine key={o.id} ordine={o} isSuperAdmin={isSuperAdmin} onAggiorna={aggiornaStato} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function CardOrdine({
  ordine,
  isSuperAdmin,
  onAggiorna,
}: {
  ordine: OrdineVocale;
  isSuperAdmin: boolean;
  onAggiorna: (id: string, stato: "preso_in_carico" | "annullato") => void;
}) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", borderTop: `4px solid ${ordine.stato === "nuovo" ? "#4a7ec8" : "#8a7a65"}` }}>
      <div style={{ padding: "12px 16px", background: "var(--surface-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 22, fontWeight: 700, color: "var(--text)" }}>#{ordine.numeroOrdine}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {new Date(ordine.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
            {isSuperAdmin && ` · ${ordine.sede.nome.replace("Don Basilico ", "")}`}
          </div>
        </div>
        <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: ordine.tipo === "domicilio" ? "rgba(200,90,46,0.15)" : "rgba(74,158,107,0.15)", color: ordine.tipo === "domicilio" ? "var(--text)" : "#4a9e6b" }}>
          {ordine.tipo === "domicilio" ? "🛵 Domicilio" : "🏠 Asporto"}
        </span>
      </div>

      <div style={{ padding: "12px 16px" }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
          👤 {ordine.clienteNome} · 📞 {ordine.clienteTelefono}
        </div>
        {ordine.tipo === "domicilio" && ordine.clienteIndirizzo && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>📍 {ordine.clienteIndirizzo}</div>
        )}

        {ordine.articoli.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: i < ordine.articoli.length - 1 ? "1px solid var(--border)" : "none", fontSize: 14 }}>
            <span style={{ fontFamily: "var(--font-ui)", color: "var(--text)", fontWeight: 700, minWidth: 28 }}>{a.quantita}x</span>
            <div>
              <div>
                {a.nomeSnapshot}
                {a.taglia === "maxi" && <span style={{ marginLeft: 6, fontSize: 10, background: "var(--text)", color: "white", padding: "1px 6px", borderRadius: 8 }}>MAXI</span>}
              </div>
              {a.extra.length > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>+ {a.extra.map((e) => e.nome).join(", ")}</div>}
              {a.note && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>→ {a.note}</div>}
            </div>
          </div>
        ))}

        {ordine.note && (
          <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(212,168,83,0.1)", borderRadius: 6, fontSize: 12, color: "#d4a853" }}>
            📝 {ordine.note}
          </div>
        )}

        <div style={{ marginTop: 10, fontFamily: "var(--font-ui)", fontSize: 18, fontWeight: 700, color: "#d4a853" }}>
          €{parseFloat(ordine.totale).toFixed(2)}
        </div>
      </div>

      <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
        {ordine.stato === "nuovo" && (
          <button onClick={() => onAggiorna(ordine.id, "preso_in_carico")} style={{ flex: 1, background: "#4a9e6b", border: "none", color: "white", padding: "10px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            ✓ Preso in carico
          </button>
        )}
        <button onClick={() => onAggiorna(ordine.id, "annullato")} title="Annulla ordine" style={{ background: "rgba(200,64,64,0.1)", border: "1px solid rgba(200,64,64,0.3)", color: "#c84040", padding: "10px 12px", borderRadius: 8, fontSize: 14, cursor: "pointer" }}>
          ✕
        </button>
      </div>
    </div>
  );
}
