"use client";

import { useEffect, useState } from "react";

const CAT_LABEL: Record<string, string> = {
  pizze: "Pizze", pizze_rosse: "Pizze rosse", pizze_bianche: "Pizze bianche",
  calzoni: "Calzoni", fritti: "Fritti", bevande: "Bevande", dolci: "Dolci",
  extra: "Extra", menu_speciale: "Menù speciale",
};

const fieldSt: React.CSSProperties = {
  width: "100%", background: "#fff", border: "1px solid var(--border)",
  color: "var(--text)", padding: "11px 14px", borderRadius: 9, fontSize: 15,
  outline: "none", fontFamily: "var(--font-ui)",
};
const btnPrimarySt: React.CSSProperties = {
  width: "100%", background: "var(--text)", color: "#fff", border: "none",
  padding: 14, borderRadius: 9, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)",
};

function euro(n: number) {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

interface Cliente { id: string; nome: string; telefono: string | null; }
interface CartItem { cartId: string; menuItemId: string; nome: string; prezzo: number; qty: number; }

export default function OrdinaFlow({ sedeSlugIniziale }: { sedeSlugIniziale?: string }) {
  const [caricamento, setCaricamento] = useState(true);
  const [cliente, setCliente] = useState<Cliente | null>(null);

  // Gate OTP
  const [passoGate, setPassoGate] = useState<"telefono" | "codice">("telefono");
  const [telefono, setTelefono] = useState("");
  const [nome, setNome] = useState("");
  const [codice, setCodice] = useState("");
  const [inviandoOtp, setInviandoOtp] = useState(false);
  const [erroreGate, setErroreGate] = useState("");

  // Flusso ordine
  const [sedi, setSedi] = useState<any[]>([]);
  const [tipo, setTipo] = useState<"asporto" | "domicilio" | null>(null);
  const [sedeSelezionata, setSedeSelezionata] = useState<string>("");
  const [indirizzo, setIndirizzo] = useState("");
  const [statoIndirizzo, setStatoIndirizzo] = useState<"idle" | "verificando" | "ok" | "errore">("idle");
  const [sedeAssegnata, setSedeAssegnata] = useState<{ id: string; nome: string } | null>(null);
  const [erroreIndirizzo, setErroreIndirizzo] = useState("");

  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [catFiltro, setCatFiltro] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [metodoPagamento, setMetodoPagamento] = useState<"contanti" | "carta" | "">("");
  const [note, setNote] = useState("");
  const [invio, setInvio] = useState(false);
  const [erroreInvio, setErroreInvio] = useState("");
  const [confermato, setConfermato] = useState<{ numeroOrdine: number; sede: string; totale: number } | null>(null);

  useEffect(() => {
    fetch("/api/ordina/sessione").then((r) => r.json()).then((d) => { setCliente(d.cliente ?? null); setCaricamento(false); });
    fetch("/api/sedi").then((r) => r.json()).then((d) => setSedi(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (sedeSlugIniziale && sedi.length) {
      const s = sedi.find((s) => s.slug === sedeSlugIniziale);
      if (s) { setTipo("asporto"); setSedeSelezionata(s.id); }
    }
  }, [sedeSlugIniziale, sedi]);

  const sedeIdAttiva = tipo === "asporto" ? sedeSelezionata : sedeAssegnata?.id ?? "";

  useEffect(() => {
    if (!sedeIdAttiva) { setMenuItems([]); return; }
    fetch(`/api/menu?sedeId=${sedeIdAttiva}`).then((r) => r.json()).then((d) =>
      setMenuItems((d.items ?? []).filter((i: any) => i.isAttivo && i.disponibileInSede !== false)));
  }, [sedeIdAttiva]);

  const richiediOtp = async () => {
    setErroreGate("");
    if (!telefono.trim() || !nome.trim()) { setErroreGate("Inserisci nome e telefono"); return; }
    setInviandoOtp(true);
    const res = await fetch("/api/ordina/otp/richiedi", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telefono }),
    });
    setInviandoOtp(false);
    const data = await res.json();
    if (!res.ok) { setErroreGate(data.error ?? "Errore, riprova"); return; }
    setPassoGate("codice");
  };

  const verificaOtp = async () => {
    setErroreGate("");
    if (!codice.trim()) { setErroreGate("Inserisci il codice ricevuto via SMS"); return; }
    setInviandoOtp(true);
    const res = await fetch("/api/ordina/otp/verifica", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telefono, codice, nome }),
    });
    setInviandoOtp(false);
    const data = await res.json();
    if (!res.ok) { setErroreGate(data.error ?? "Codice non valido"); return; }
    setCliente(data.cliente);
  };

  const verificaIndirizzo = async () => {
    setErroreIndirizzo("");
    setSedeAssegnata(null);
    if (!indirizzo.trim()) return;
    setStatoIndirizzo("verificando");
    const res = await fetch("/api/ordina/copertura", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ indirizzo }),
    });
    const data = await res.json();
    if (data.coperto) {
      setSedeAssegnata({ id: data.sedeId, nome: data.sedeNome });
      setStatoIndirizzo("ok");
    } else {
      setStatoIndirizzo("errore");
      setErroreIndirizzo(data.motivo ?? "Indirizzo non coperto");
    }
  };

  const aggiungiAlCarrello = (item: any) => {
    const prezzo = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
    setCart((prev) => {
      const ex = prev.find((c) => c.menuItemId === item.id);
      if (ex) return prev.map((c) => c.cartId === ex.cartId ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { cartId: crypto.randomUUID(), menuItemId: item.id, nome: item.nome, prezzo, qty: 1 }];
    });
  };

  const totale = cart.reduce((a, c) => a + c.prezzo * c.qty, 0);

  const inviaOrdine = async () => {
    setErroreInvio("");
    if (!cart.length) { setErroreInvio("Il carrello è vuoto"); return; }
    if (tipo === "domicilio" && !metodoPagamento) { setErroreInvio("Scegli come pagare"); return; }
    setInvio(true);
    const sedeAsporto = sedi.find((s) => s.id === sedeSelezionata);
    const res = await fetch("/api/ordina/conferma", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        clienteIndirizzo: tipo === "domicilio" ? indirizzo : undefined,
        sedeSlugAsporto: tipo === "asporto" ? sedeAsporto?.slug : undefined,
        metodoPagamento: tipo === "domicilio" ? metodoPagamento : undefined,
        note: note || undefined,
        articoli: cart.map((c) => ({ menuItemId: c.menuItemId, quantita: c.qty })),
      }),
    });
    setInvio(false);
    const data = await res.json();
    if (!res.ok) { setErroreInvio(data.error ?? "Errore nell'invio dell'ordine"); return; }
    setConfermato({ numeroOrdine: data.numeroOrdine, sede: data.sede, totale: data.totale });
  };

  if (caricamento) return null;

  // ── Conferma finale ──────────────────────────────────────────
  if (confermato) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div style={{ fontSize: 11, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>Ordine confermato</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 40, color: "var(--text)" }}>#{confermato.numeroOrdine}</div>
        <div style={{ fontSize: 14, color: "var(--text-2)", marginTop: 10 }}>{confermato.sede}</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--text)", marginTop: 14 }}>{euro(confermato.totale)}</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 20 }}>Il tuo ordine è in preparazione. Ti chiameremo se ci fosse bisogno di contattarti.</p>
      </div>
    );
  }

  // ── Gate registrazione/OTP ───────────────────────────────────
  if (!cliente) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--text)" }}>Ordina online</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Registrati con il tuo numero di telefono: ci serve per confermarti l'ordine e poterti chiamare in caso di problemi in consegna.</p>

        {passoGate === "telefono" ? (
          <>
            <input style={fieldSt} placeholder="Il tuo nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            <input style={fieldSt} placeholder="Numero di telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            {erroreGate && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{erroreGate}</div>}
            <button style={btnPrimarySt} onClick={richiediOtp} disabled={inviandoOtp}>
              {inviandoOtp ? "Invio…" : "Invia codice via SMS"}
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: "var(--text-2)" }}>Codice inviato a {telefono}</p>
            <input style={fieldSt} placeholder="Codice ricevuto" value={codice} onChange={(e) => setCodice(e.target.value)} />
            {erroreGate && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{erroreGate}</div>}
            <button style={btnPrimarySt} onClick={verificaOtp} disabled={inviandoOtp}>
              {inviandoOtp ? "Verifica…" : "Conferma"}
            </button>
            <button onClick={() => setPassoGate("telefono")} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer" }}>
              Numero sbagliato? Torna indietro
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Scelta ritiro/domicilio ──────────────────────────────────
  if (!tipo) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text)" }}>Ciao {cliente.nome.split(" ")[0]}</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Come vuoi ricevere il tuo ordine?</p>
        <button style={{ ...btnPrimarySt }} onClick={() => setTipo("asporto")}>Ritiro in sede</button>
        <button style={{ ...btnPrimarySt, background: "#fff", color: "var(--text)", border: "1px solid var(--border)" }} onClick={() => setTipo("domicilio")}>Consegna a domicilio</button>
      </div>
    );
  }

  if (tipo === "asporto" && !sedeSelezionata) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
        <button onClick={() => setTipo(null)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer" }}>← Indietro</button>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text)" }}>Scegli la sede</h2>
        {sedi.map((s) => (
          <button key={s.id} onClick={() => setSedeSelezionata(s.id)} style={{
            textAlign: "left", background: "#fff", border: "1px solid var(--border)", borderRadius: 10,
            padding: "12px 14px", cursor: "pointer", fontFamily: "var(--font-ui)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{s.nome}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.indirizzo}, {s.citta}</div>
          </button>
        ))}
      </div>
    );
  }

  if (tipo === "domicilio" && statoIndirizzo !== "ok") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
        <button onClick={() => setTipo(null)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer" }}>← Indietro</button>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text)" }}>Indirizzo di consegna</h2>
        <input style={fieldSt} placeholder="Via, numero civico, città" value={indirizzo} onChange={(e) => setIndirizzo(e.target.value)} />
        {statoIndirizzo === "errore" && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{erroreIndirizzo}</div>}
        <button style={btnPrimarySt} onClick={verificaIndirizzo} disabled={statoIndirizzo === "verificando"}>
          {statoIndirizzo === "verificando" ? "Verifica…" : "Continua"}
        </button>
      </div>
    );
  }

  // ── Menù + carrello ──────────────────────────────────────────
  const catsPresenti = Array.from(new Set(menuItems.map((m) => m.categoria)));
  const filtro = catFiltro || catsPresenti[0] || "";
  const itemsFiltrati = menuItems.filter((m) => m.categoria === filtro);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
      {tipo === "domicilio" && sedeAssegnata && (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Consegna da <strong style={{ color: "var(--text-2)" }}>{sedeAssegnata.nome}</strong></div>
      )}

      <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        {catsPresenti.map((c) => (
          <button key={c} onClick={() => setCatFiltro(c)} style={{
            flexShrink: 0, padding: "8px 15px", borderRadius: 20, fontSize: 12.5, cursor: "pointer",
            border: `1px solid ${filtro === c ? "var(--text)" : "var(--border)"}`,
            background: filtro === c ? "var(--text)" : "#fff",
            color: filtro === c ? "#fff" : "var(--text-3)", fontFamily: "var(--font-ui)", whiteSpace: "nowrap",
          }}>{CAT_LABEL[c] ?? c}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {itemsFiltrati.map((item) => {
          const prezzo = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
          return (
            <div key={item.id} onClick={() => aggiungiAlCarrello(item)} style={{
              background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
            }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text)" }}>{item.nome}</div>
                {item.descrizione && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>{item.descrizione}</div>}
              </div>
              <span className="num" style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", flexShrink: 0 }}>{euro(prezzo)}</span>
            </div>
          );
        })}
      </div>

      {cart.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, position: "sticky", bottom: 12 }}>
          {cart.map((c) => (
            <div key={c.cartId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ flex: 1, fontSize: 13.5, color: "var(--text)" }}>{c.nome}</span>
              <button onClick={() => setCart((p) => p.map((x) => x.cartId === c.cartId ? { ...x, qty: x.qty - 1 } : x).filter((x) => x.qty > 0))} style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)", background: "#fff", cursor: "pointer" }}>−</button>
              <span className="num" style={{ fontSize: 13, minWidth: 14, textAlign: "center" }}>{c.qty}</span>
              <button onClick={() => setCart((p) => p.map((x) => x.cartId === c.cartId ? { ...x, qty: x.qty + 1 } : x))} style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)", background: "#fff", cursor: "pointer" }}>+</button>
              <span className="num" style={{ fontSize: 13, fontWeight: 500, minWidth: 56, textAlign: "right" }}>{euro(c.prezzo * c.qty)}</span>
            </div>
          ))}

          <textarea style={{ ...fieldSt, resize: "none", marginTop: 6, marginBottom: 10 } as any} rows={2} placeholder="Note (opzionale)" value={note} onChange={(e) => setNote(e.target.value)} />

          {tipo === "domicilio" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {(["contanti", "carta"] as const).map((m) => (
                <button key={m} onClick={() => setMetodoPagamento(m)} style={{
                  flex: 1, padding: "9px", borderRadius: 9, border: "1px solid", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5,
                  background: metodoPagamento === m ? "var(--accent-bg-2)" : "transparent",
                  borderColor: metodoPagamento === m ? "var(--accent-border)" : "var(--border)",
                  color: metodoPagamento === m ? "var(--text)" : "var(--text-3)",
                }}>{m === "contanti" ? "Contanti alla consegna" : "Carta (POS a domicilio)"}</button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Totale</span>
            <span className="num" style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--text)" }}>{euro(totale)}</span>
          </div>
          {erroreInvio && <div style={{ fontSize: 12.5, color: "var(--danger)", marginBottom: 10 }}>{erroreInvio}</div>}
          <button style={btnPrimarySt} onClick={inviaOrdine} disabled={invio}>{invio ? "Invio…" : "Conferma ordine"}</button>
        </div>
      )}
    </div>
  );
}
