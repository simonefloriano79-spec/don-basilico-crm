"use client";

import { useEffect, useState } from "react";
import { COSTO_CONSEGNA_DEFAULT } from "@/lib/consegna";

const CAT_LABEL: Record<string, string> = {
  pizze: "Pizze", pizze_rosse: "Pizze rosse", pizze_bianche: "Pizze bianche",
  calzoni: "Calzoni", fritti: "Fritti", bevande: "Bevande", dolci: "Dolci",
  extra: "Extra", menu_speciale: "Pizze speciali",
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

const fmtOrario = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

interface Cliente { id: string; nome: string; telefono: string | null; }
interface IngredienteCl {
  id: string; nome: string; prezzoAggiunta: number | string;
  disabilitatoInSede?: boolean; escludiCompensazione?: boolean;
}
interface CartItem {
  cartId: string; menuItemId: string; nome: string; categoria: string;
  prezzo: number; qty: number;
  rimossi: { id: string; nome: string }[];
  aggiunti: { id: string; nome: string }[];
  nota: string;
}
interface SlotCl { ora: string; iso: string; pieno: boolean; }
interface SlotData {
  apertura: string; chiusura: string; apertoOra: boolean;
  primoGiorno: "oggi" | "domani"; oggi: SlotCl[]; domani: SlotCl[];
}

// Categorie che aprono la finestra di personalizzazione (e che pesano sulla capienza cucina).
const CAT_PIZZA = ["menu_speciale", "pizze_rosse", "pizze_bianche", "calzoni"];
// Ordine delle sezioni del menù: speciali, rosse, bianche, calzoni, fritti, dolci, bevande.
const ORDINE_CAT = ["menu_speciale", "pizze", "pizze_rosse", "pizze_bianche", "calzoni", "fritti", "dolci", "bevande", "extra"];
const posCat = (c: string) => { const i = ORDINE_CAT.indexOf(c); return i < 0 ? ORDINE_CAT.length : i; };
const num = (v: number | string | undefined) => parseFloat(String(v ?? 0)) || 0;

// Finestra di personalizzazione pizza: toglie ingredienti base, aggiunge extra.
// Stessa regola della cassa: togliere non genera sconto da solo, ma "copre" fino al
// suo valore gli extra aggiunti (mozzarella/pomodoro e simili non danno credito).
function PizzaModalCliente({ item, ingredienti, onConferma, onChiudi }: {
  item: any; ingredienti: IngredienteCl[];
  onConferma: (c: Omit<CartItem, "cartId">) => void; onChiudi: () => void;
}) {
  const base: IngredienteCl[] = (item.ingredienti ?? []).map((ii: any) => ii.ingrediente ?? ii);
  const [rimossi, setRimossi] = useState<Set<string>>(new Set());
  const [aggiunti, setAggiunti] = useState<Map<string, IngredienteCl>>(new Map());
  const [nota, setNota] = useState("");
  const [qty, setQty] = useState(1);
  const [cerca, setCerca] = useState("");

  const prezzoBase = num(item.prezzoEffettivo ?? item.prezzoBase);
  const lordo = Array.from(aggiunti.values()).reduce((a, i) => a + num(i.prezzoAggiunta), 0);
  const credito = base.filter((i) => rimossi.has(i.id) && !i.escludiCompensazione).reduce((a, i) => a + num(i.prezzoAggiunta), 0);
  const unitario = prezzoBase + Math.max(0, lordo - credito);

  const extra = ingredienti.filter((i) => !rimossi.has(i.id) && !i.disabilitatoInSede
    && i.nome.toLowerCase().includes(cerca.toLowerCase()));

  const toggle = <T,>(set: Set<T>, v: T) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); return n; };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.55)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={onChiudi}>
      <div style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", maxHeight: "92vh", display: "flex", flexDirection: "column", width: "100%", maxWidth: 560, margin: "0 auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "18px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 21, color: "var(--text)" }}>{item.nome}</div>
          <span className="num" style={{ fontSize: 14, color: "var(--text-2)" }}>{euro(prezzoBase)}</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 12px" }}>
          {base.length > 0 && (
            <>
              <div style={{ fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-muted)", margin: "6px 0 8px" }}>Ingredienti — tocca per togliere</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {base.map((i) => (
                  <button key={i.id} onClick={() => setRimossi((p) => toggle(p, i.id))} style={{
                    padding: "7px 13px", borderRadius: 20, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-ui)",
                    border: `1px solid ${rimossi.has(i.id) ? "var(--danger-border)" : "var(--border)"}`,
                    background: rimossi.has(i.id) ? "var(--danger-bg)" : "#fff",
                    color: rimossi.has(i.id) ? "var(--danger)" : "var(--text)",
                    textDecoration: rimossi.has(i.id) ? "line-through" : "none",
                  }}>{i.nome}</button>
                ))}
              </div>
            </>
          )}
          <div style={{ fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Aggiungi</div>
          <input style={{ ...fieldSt, marginBottom: 8 }} placeholder="Cerca ingrediente…" value={cerca} onChange={(e) => setCerca(e.target.value)} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, maxHeight: 190, overflowY: "auto" }}>
            {extra.map((i) => {
              const on = aggiunti.has(i.id);
              return (
                <button key={i.id} onClick={() => setAggiunti((p) => { const n = new Map(p); on ? n.delete(i.id) : n.set(i.id, i); return n; })} style={{
                  padding: "7px 13px", borderRadius: 20, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-ui)",
                  border: `1px solid ${on ? "var(--accent-border)" : "var(--border)"}`,
                  background: on ? "var(--accent-bg-2)" : "#fff", color: "var(--text)",
                }}>{on ? "✓ " : "+ "}{i.nome}{num(i.prezzoAggiunta) > 0 ? ` (${euro(num(i.prezzoAggiunta))})` : ""}</button>
              );
            })}
          </div>
          <textarea style={{ ...fieldSt, resize: "none" } as any} rows={2} placeholder="Note per questa pizza (opzionale)" value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>
        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", fontSize: 16 }}>−</button>
            <span className="num" style={{ minWidth: 18, textAlign: "center" }}>{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", fontSize: 16 }}>+</button>
          </div>
          <button style={{ ...btnPrimarySt, flex: 1 }} onClick={() => onConferma({
            menuItemId: item.id, nome: item.nome, categoria: item.categoria, prezzo: unitario, qty,
            rimossi: base.filter((i) => rimossi.has(i.id)).map((i) => ({ id: i.id, nome: i.nome })),
            aggiunti: Array.from(aggiunti.values()).map((i) => ({ id: i.id, nome: i.nome })),
            nota: nota.trim(),
          })}>Aggiungi · {euro(unitario * qty)}</button>
        </div>
      </div>
    </div>
  );
}

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
  const [confermato, setConfermato] = useState<{ numeroOrdine: number; sede: string; totale: number; oraRitiro: string | null } | null>(null);
  const [nomeCitofono, setNomeCitofono] = useState("");
  const [ingredienti, setIngredienti] = useState<IngredienteCl[]>([]);
  const [pizzaModal, setPizzaModal] = useState<any>(null);
  const [slotData, setSlotData] = useState<SlotData | null>(null);
  const [orario, setOrario] = useState<string>(""); // "asap" oppure ISO dello slot scelto
  const [giornoSlot, setGiornoSlot] = useState<"oggi" | "domani">("oggi");

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
    fetch(`/api/ingredienti?sedeId=${sedeIdAttiva}`).then((r) => r.json()).then((d) =>
      setIngredienti(Array.isArray(d) ? d : []));
  }, [sedeIdAttiva]);

  // Peso del carrello sulla cucina (pizze equivalenti) e orari prenotabili con disponibilità.
  const pesoCarrello = cart.reduce((a, c) => a + (CAT_PIZZA.includes(c.categoria) ? c.qty : 0), 0);
  useEffect(() => {
    if (!sedeIdAttiva) { setSlotData(null); return; }
    let annullato = false;
    fetch(`/api/ordina/slot?sedeId=${sedeIdAttiva}&peso=${Math.max(1, pesoCarrello)}`)
      .then((r) => r.json())
      .then((d: SlotData & { error?: string }) => {
        if (annullato || d.error) return;
        setSlotData(d);
        setGiornoSlot((g) => (d.apertoOra ? g : d.primoGiorno));
        // Con la sede chiusa "appena possibile" non esiste: si deve scegliere un orario.
        setOrario((o) => (!d.apertoOra && o === "asap" ? "" : o === "" && d.apertoOra ? "asap" : o));
      })
      .catch(() => {});
    return () => { annullato = true; };
  }, [sedeIdAttiva, pesoCarrello]);

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
    if (CAT_PIZZA.includes(item.categoria)) { setPizzaModal(item); return; }
    const prezzo = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
    setCart((prev) => {
      const ex = prev.find((c) => c.menuItemId === item.id && !c.rimossi.length && !c.aggiunti.length && !c.nota);
      if (ex) return prev.map((c) => c.cartId === ex.cartId ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { cartId: crypto.randomUUID(), menuItemId: item.id, nome: item.nome, categoria: item.categoria, prezzo, qty: 1, rimossi: [], aggiunti: [], nota: "" }];
    });
  };

  const subtotale = cart.reduce((a, c) => a + c.prezzo * c.qty, 0);
  const consegna = tipo === "domicilio" ? COSTO_CONSEGNA_DEFAULT : 0;
  const totale = subtotale + consegna;

  const inviaOrdine = async () => {
    setErroreInvio("");
    if (!cart.length) { setErroreInvio("Il carrello è vuoto"); return; }
    if (tipo === "domicilio" && !metodoPagamento) { setErroreInvio("Scegli come pagare"); return; }
    if (!orario) { setErroreInvio("Scegli l'orario di ritiro"); return; }
    setInvio(true);
    const sedeAsporto = sedi.find((s) => s.id === sedeSelezionata);
    const res = await fetch("/api/ordina/conferma", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        clienteIndirizzo: tipo === "domicilio" ? indirizzo : undefined,
        sedeSlugAsporto: tipo === "asporto" ? sedeAsporto?.slug : undefined,
        metodoPagamento: tipo === "domicilio" ? metodoPagamento : undefined,
        nomeCitofono: tipo === "domicilio" ? nomeCitofono || undefined : undefined,
        oraRitiro: orario === "asap" ? undefined : orario,
        note: note || undefined,
        articoli: cart.map((c) => ({
          menuItemId: c.menuItemId, quantita: c.qty,
          ingredientiAggiuntiIds: c.aggiunti.map((i) => i.id),
          ingredientiRimossi: c.rimossi.map((i) => i.id),
          note: c.nota || undefined,
        })),
      }),
    });
    setInvio(false);
    const data = await res.json();
    if (!res.ok) { setErroreInvio(data.error ?? "Errore nell'invio dell'ordine"); return; }
    setConfermato({ numeroOrdine: data.numeroOrdine, sede: data.sede, totale: data.totale, oraRitiro: data.oraRitiro });
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
        {confermato.oraRitiro && (
          <div style={{ fontSize: 14, color: "var(--text-2)", marginTop: 10 }}>
            {tipo === "domicilio" ? "Consegna richiesta" : "Ritiro richiesto"}: <strong>{fmtOrario(confermato.oraRitiro)}</strong>
          </div>
        )}
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 20, lineHeight: 1.5 }}>
          Abbiamo ricevuto il tuo ordine, ora è <strong>in attesa di conferma dalla pizzeria</strong>.
          Riceverai un SMS al {cliente?.telefono ?? "tuo numero"} con l'orario confermato
          {confermato.oraRitiro ? " (potrebbe variare di poco in base agli ordini in corso)" : ""}.
        </p>
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
        <input style={fieldSt} placeholder="Cognome / nome sul citofono" value={nomeCitofono} onChange={(e) => setNomeCitofono(e.target.value)} />
        {statoIndirizzo === "errore" && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{erroreIndirizzo}</div>}
        <button style={btnPrimarySt} onClick={verificaIndirizzo} disabled={statoIndirizzo === "verificando"}>
          {statoIndirizzo === "verificando" ? "Verifica…" : "Continua"}
        </button>
      </div>
    );
  }

  // ── Menù + carrello ──────────────────────────────────────────
  const catsPresenti = Array.from(new Set(menuItems.map((m) => m.categoria as string))).sort((a, b) => posCat(a) - posCat(b));
  const filtro = catFiltro || catsPresenti[0] || "";
  const itemsFiltrati = menuItems.filter((m) => m.categoria === filtro);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
      {tipo === "domicilio" && sedeAssegnata && (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Consegna da <strong style={{ color: "var(--text-2)" }}>{sedeAssegnata.nome}</strong></div>
      )}

      {slotData && !slotData.apertoOra && (
        <div style={{ background: "var(--accent-bg-2)", border: "1px solid var(--accent-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--text)" }}>
          Al momento siamo chiusi (orario {slotData.apertura}–{slotData.chiusura}). Puoi comunque ordinare scegliendo l'orario di
          {" "}{tipo === "domicilio" ? "consegna" : "ritiro"}{slotData.primoGiorno === "domani" ? ": gli orari disponibili sono per domani" : ""}.
        </div>
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
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: "var(--text)" }}>{c.nome}</div>
                {c.rimossi.length > 0 && <div style={{ fontSize: 11, color: "var(--danger)" }}>Senza: {c.rimossi.map((i) => i.nome).join(", ")}</div>}
                {c.aggiunti.length > 0 && <div style={{ fontSize: 11, color: "var(--accent-ink)" }}>Con: {c.aggiunti.map((i) => i.nome).join(", ")}</div>}
                {c.nota && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.nota}</div>}
              </div>
              <button onClick={() => setCart((p) => p.map((x) => x.cartId === c.cartId ? { ...x, qty: x.qty - 1 } : x).filter((x) => x.qty > 0))} style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)", background: "#fff", cursor: "pointer" }}>−</button>
              <span className="num" style={{ fontSize: 13, minWidth: 14, textAlign: "center" }}>{c.qty}</span>
              <button onClick={() => setCart((p) => p.map((x) => x.cartId === c.cartId ? { ...x, qty: x.qty + 1 } : x))} style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)", background: "#fff", cursor: "pointer" }}>+</button>
              <span className="num" style={{ fontSize: 13, fontWeight: 500, minWidth: 56, textAlign: "right" }}>{euro(c.prezzo * c.qty)}</span>
            </div>
          ))}

          <textarea style={{ ...fieldSt, resize: "none", marginTop: 6, marginBottom: 10 } as any} rows={2} placeholder="Note (opzionale)" value={note} onChange={(e) => setNote(e.target.value)} />

          {slotData && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
                {tipo === "domicilio" ? "Orario di consegna" : "Orario di ritiro"}
              </div>
              {slotData.apertoOra && (
                <button onClick={() => setOrario("asap")} style={{
                  width: "100%", marginBottom: 8, padding: "10px", borderRadius: 9, border: "1px solid", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13,
                  background: orario === "asap" ? "var(--accent-bg-2)" : "transparent",
                  borderColor: orario === "asap" ? "var(--accent-border)" : "var(--border)", color: "var(--text)",
                }}>Appena possibile</button>
              )}
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {(["oggi", "domani"] as const).map((g) => {
                  const disp = slotData[g].length > 0;
                  return (
                    <button key={g} disabled={!disp} onClick={() => setGiornoSlot(g)} style={{
                      flex: 1, padding: "8px", borderRadius: 9, border: "1px solid", fontFamily: "var(--font-ui)", fontSize: 12.5,
                      cursor: disp ? "pointer" : "default", opacity: disp ? 1 : 0.4,
                      background: giornoSlot === g ? "var(--text)" : "transparent",
                      borderColor: giornoSlot === g ? "var(--text)" : "var(--border)",
                      color: giornoSlot === g ? "#fff" : "var(--text-3)",
                    }}>{g === "oggi" ? "Oggi" : "Domani"}</button>
                  );
                })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, maxHeight: 150, overflowY: "auto" }}>
                {slotData[giornoSlot].map((sl) => (
                  <button key={sl.iso} disabled={sl.pieno} onClick={() => setOrario(sl.iso)} style={{
                    padding: "8px 0", borderRadius: 8, border: "1px solid", fontFamily: "var(--font-ui)", fontSize: 12.5,
                    cursor: sl.pieno ? "default" : "pointer", opacity: sl.pieno ? 0.35 : 1,
                    textDecoration: sl.pieno ? "line-through" : "none",
                    background: orario === sl.iso ? "var(--accent-bg-2)" : "transparent",
                    borderColor: orario === sl.iso ? "var(--accent-border)" : "var(--border)", color: "var(--text)",
                  }}>{sl.ora}</button>
                ))}
              </div>
              {giornoSlot === "domani" && !slotData.oggi.length && (
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>Per oggi gli orari sono terminati: il tuo ordine sarà per domani.</div>
              )}
            </div>
          )}

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

          {consegna > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Consegna</span>
              <span className="num" style={{ fontSize: 12.5, color: "var(--text-2)" }}>{euro(consegna)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Totale</span>
            <span className="num" style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--text)" }}>{euro(totale)}</span>
          </div>
          {erroreInvio && <div style={{ fontSize: 12.5, color: "var(--danger)", marginBottom: 10 }}>{erroreInvio}</div>}
          <button style={btnPrimarySt} onClick={inviaOrdine} disabled={invio}>{invio ? "Invio…" : "Invia ordine"}</button>
        </div>
      )}

      {pizzaModal && (
        <PizzaModalCliente item={pizzaModal} ingredienti={ingredienti}
          onChiudi={() => setPizzaModal(null)}
          onConferma={(c) => { setCart((p) => [...p, { ...c, cartId: crypto.randomUUID() }]); setPizzaModal(null); }} />
      )}
    </div>
  );
}
