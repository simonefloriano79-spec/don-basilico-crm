"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Pizza, Sparkles, Cake, Gift } from "lucide-react";

const euro = (n: number) => `€ ${n.toFixed(2).replace(".", ",")}`;

interface Scheda {
  token: string; nome: string; pizzeria: string; ciclo: number; timbri: number; totaleCiclo: number;
  scontoDisponibile: boolean; compleannoDisponibile: boolean; magliaDisponibile: boolean;
  ordini: { posizione: number; importo: number }[];
}

const bottone: React.CSSProperties = {
  width: "100%", background: "var(--text)", color: "#fff", border: "none", padding: 16, borderRadius: 14,
  fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)",
};

// "La mia tessera": la stessa tessera che si apre dal QR (timbri, sconto maturato, premi, ordini del ciclo),
// con il QR personale da mostrare in pizzeria.
export default function PaginaTessera({ onIndietro, sedi }: { onIndietro: () => void; sedi: { slug: string; nome: string }[] }) {
  const [scheda, setScheda] = useState<Scheda | null>(null);
  const [caricato, setCaricato] = useState(false);
  const [errore, setErrore] = useState("");
  const [qr, setQr] = useState("");
  const [sedeScelta, setSedeScelta] = useState("");
  const [attivando, setAttivando] = useState(false);

  const carica = () =>
    fetch("/api/ordina/tessera")
      .then((r) => r.json())
      .then((d) => { setScheda(d.scheda ?? null); setCaricato(true); })
      .catch(() => { setErrore("Non riesco a caricare la tessera"); setCaricato(true); });

  useEffect(() => {
    carica();
    const iv = setInterval(carica, 20000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!scheda?.token) return;
    QRCode.toDataURL(scheda.token, { margin: 2, width: 360, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(""));
  }, [scheda?.token]);

  const attiva = async () => {
    if (!sedeScelta) { setErrore("Scegli la tua pizzeria"); return; }
    setErrore(""); setAttivando(true);
    const res = await fetch("/api/ordina/tessera", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sedeSlug: sedeScelta }) });
    const d = await res.json().catch(() => ({}));
    setAttivando(false);
    if (!res.ok) { setErrore(d.error ?? "Errore, riprova"); return; }
    carica();
  };

  const indietro = (
    <button onClick={onIndietro} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, cursor: "pointer", padding: "4px 0" }}>← Indietro</button>
  );

  if (!caricato) return <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: 30 }}>Carico la tessera…</div>;

  // Nessuna tessera: si può attivare subito (il consenso privacy c'è già)
  if (!scheda) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 420, width: "100%", margin: "0 auto" }}>
        {indietro}
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text)", textAlign: "center" }}>Tessera fedeltà</h1>
        <p style={{ fontSize: 14, color: "var(--text-2)", textAlign: "center", lineHeight: 1.55 }}>
          Ogni ordine è un timbro: ogni 5 ottieni il 10% di sconto sulla spesa (consegna esclusa). Attiva la tessera e mostra il QR in pizzeria.
        </p>
        <select value={sedeScelta} onChange={(e) => setSedeScelta(e.target.value)}
          style={{ width: "100%", background: "#fff", border: "1px solid var(--border)", color: "var(--text)", padding: "14px 16px", borderRadius: 14, fontSize: 16, fontFamily: "var(--font-ui)" }}>
          <option value="">La tua pizzeria *</option>
          {sedi.map((s) => <option key={s.slug} value={s.slug}>{s.nome.replace("Don Basilico ", "")}</option>)}
        </select>
        {errore && <div style={{ fontSize: 13, color: "var(--danger)" }}>{errore}</div>}
        <button style={bottone} onClick={attiva} disabled={attivando}>{attivando ? "Attivo…" : "Attiva la tessera"}</button>
      </div>
    );
  }

  const sconto = Math.round(scheda.totaleCiclo * 0.1 * 100) / 100;
  const premio = (bg: string, col: string, icona: React.ReactNode, testo: string) => (
    <div style={{ background: bg, color: col, borderRadius: 18, padding: 18, display: "flex", justifyContent: "center", alignItems: "center", textAlign: "center", gap: 10, fontWeight: 700, fontSize: 14, lineHeight: 1.4 }}>
      {icona}<span>{testo}</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 520, width: "100%", margin: "0 auto" }}>
      {indietro}
      {errore && <div style={{ fontSize: 13, color: "var(--danger)", textAlign: "center" }}>{errore}</div>}

      <section style={{ background: "linear-gradient(145deg,#001309,#053117)", color: "#fff", padding: "30px 20px 26px", textAlign: "center", borderRadius: 28 }}>
        <img src="/ordina-icons/baffi.png" alt="" style={{ width: 84, height: "auto", display: "block", margin: "0 auto 14px" }} />
        <div style={{ letterSpacing: "0.13em", fontSize: 12 }}>TESSERA FEDELTÀ</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 38, margin: "14px 0 4px", textTransform: "capitalize" }}>{scheda.nome}</h1>
        <div style={{ color: "#c9d6ca", fontSize: 13 }}>{scheda.pizzeria}</div>
        <div style={{ letterSpacing: "0.13em", fontSize: 12, marginTop: 18 }}>CICLO {scheda.ciclo} — {scheda.timbri}/5 TIMBRI</div>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10, margin: "20px 0" }}>
          {[1, 2, 3, 4, 5].map((i) => {
            const pieno = i <= scheda.timbri;
            return (
              <div key={i} style={{
                width: 52, height: 52, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800,
                border: `1px solid ${pieno ? "var(--accent)" : "#60806a"}`, background: pieno ? "var(--accent)" : "transparent", color: pieno ? "#102006" : "#b9c8bc",
              }}>{pieno ? <Pizza size={24} /> : i}</div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 440, margin: "auto", paddingTop: 18, borderTop: "1px solid #31503b" }}>
          <span style={{ fontSize: 13, letterSpacing: "0.04em" }}>Sconto maturato al 6° acquisto</span>
          <b style={{ fontSize: 25 }}>{euro(sconto)}</b>
        </div>
      </section>

      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 18, padding: 16, display: "flex", gap: 14, alignItems: "center" }}>
        {qr ? <img src={qr} alt="Il tuo QR personale" style={{ width: 150, height: 150, flexShrink: 0 }} /> : <div style={{ width: 150, height: 150, flexShrink: 0 }} />}
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text)", marginBottom: 4 }}>Il tuo QR personale</div>
          <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5, margin: 0 }}>Mostralo al personale per trovare rapidamente la tessera e ricevere i timbri.</p>
        </div>
      </div>

      {scheda.scontoDisponibile && premio("#e9f8df", "#1e692f", <Sparkles size={20} />, "Sconto del 10% disponibile")}
      {scheda.compleannoDisponibile && premio("#fff3d6", "#8a5a00", <Cake size={20} />, "Sconto compleanno 15% disponibile questo mese")}
      {scheda.magliaDisponibile && premio("#e6f0ff", "#1e4c8a", <Gift size={20} />, "Hai completato 3 cicli! Ritira la tua maglia Don Basilico in negozio")}

      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 18, padding: "16px 18px" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text)", marginBottom: 8 }}>Ordini ciclo corrente</div>
        {scheda.ordini.length ? scheda.ordini.map((o) => (
          <div key={o.posizione} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--text-2)", padding: "6px 0", borderTop: "1px solid var(--border)" }}>
            <span>Pizza {o.posizione}</span><b className="num" style={{ color: "var(--text)" }}>{euro(o.importo)}</b>
          </div>
        )) : <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>Nessun timbro registrato.</p>}
      </div>
    </div>
  );
}
