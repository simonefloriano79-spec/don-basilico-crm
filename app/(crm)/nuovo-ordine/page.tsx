"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { stampaBrowser } from "@/lib/print";
import { bevandaAmmessaInCombo, comboDisponibileIn, leggiComboConfig, testoDettaglioCombo } from "@/lib/combo";

const CAT_LABEL: Record<string, string> = {
  pizze_rosse: "Pizze rosse", pizze_bianche: "Pizze bianche", calzoni: "Calzoni",
  fritti: "Fritti", bevande: "Bevande", dolci: "Dolci", extra: "Extra", menu_speciale: "Speciali", focacce: "Focacce", combo: "Menù Combo",
};

const fieldSt: React.CSSProperties = {
  width: "100%", background: "var(--surface-muted)", border: "1px solid var(--border)",
  color: "var(--text)", padding: "9px 12px", borderRadius: 9, fontSize: 12.5,
  outline: "none", fontFamily: "var(--font-ui)",
};

function euro(n: number) {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

interface Ingrediente {
  id: string; nome: string; prezzoAggiunta: number;
  isAllergene: boolean; disabilitatoInSede?: boolean; escludiCompensazione?: boolean;
}
interface ImpastoCassa { id: string; nome: string; descrizione: string | null; supplemento: number; }
const CAT_IMPASTO = ["menu_speciale", "pizze_rosse", "pizze_bianche", "focacce"];

interface CartItem {
  impasto?: { id: string; nome: string; supplemento: number };
  cartId: string; menuItemId: string; nome: string; prezzoBase: number; qty: number;
  ingredientiRimossi: { id: string; nome: string }[];
  ingredientiAggiunti: { id: string; nome: string; prezzo: number }[];
  noteItem: string; prezzoTotaleItem: number;
  categoria: string;
  // Solo «Menù Combo»: le scelte fatte (id di bibite e pizze) e il testo di cosa contiene, per carrello e comanda.
  combo?: { scelte: { bibite: string[]; pizze: string[] }; dettaglio: string };
}

// ── Modale configurazione pizza ───────────────────────────────
function PizzaModal({ item, tuttiIngredienti, sedeId, onConferma, onChiudi }: {
  item: any; tuttiIngredienti: Ingrediente[]; sedeId: string;
  onConferma: (c: CartItem) => void; onChiudi: () => void;
}) {
  const baseIngs: Ingrediente[] = (item.ingredienti ?? []).map((ii: any) => ii.ingrediente ?? ii);
  const baseIds = new Set(baseIngs.map((i) => i.id));
  const [rimossi, setRimossi] = useState<Set<string>>(new Set());
  const [aggiunti, setAggiunti] = useState<Map<string, Ingrediente>>(new Map());
  const [nota, setNota] = useState("");
  const [qty, setQty] = useState(1);
  const [search, setSearch] = useState("");
  const [impasti, setImpasti] = useState<ImpastoCassa[]>([]);
  const [impastoId, setImpastoId] = useState<string | null>(null);
  useEffect(() => {
    if (!sedeId || !CAT_IMPASTO.includes(item.categoria)) return;
    fetch(`/api/impasti?sedeId=${sedeId}`).then((r) => r.json()).then((d) => setImpasti(d.impasti ?? [])).catch(() => {});
  }, [sedeId, item.categoria]);
  const impastoScelto = impasti.find((x) => x.id === impastoId) ?? null;

  const extra = tuttiIngredienti.filter((i) => !rimossi.has(i.id) && !i.disabilitatoInSede
    && i.nome.toLowerCase().includes(search.toLowerCase()));
  const prezzoBase = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
  const prezzoAggiuntiLordo = Array.from(aggiunti.values()).reduce((a, i) => a + parseFloat(i.prezzoAggiunta?.toString() ?? "0"), 0);
  // Compensazione: rimuovere un ingrediente non genera mai uno sconto da solo, ma
  // "copre" fino al suo valore un ingrediente aggiunto al suo posto — es. tolgo
  // carciofi (1€) e aggiungo salsa tartufata (2€): pago solo 1€ di differenza.
  const credito = baseIngs.filter((i) => rimossi.has(i.id) && !i.escludiCompensazione).reduce((a, i) => a + parseFloat(i.prezzoAggiunta?.toString() ?? "0"), 0);
  const prezzoExtra = Math.max(0, prezzoAggiuntiLordo - credito);
  const supplementoImpasto = impastoScelto?.supplemento ?? 0;
  const totale = (prezzoBase + prezzoExtra + supplementoImpasto) * qty;

  const conferma = () => {
    onConferma({
      cartId: crypto.randomUUID(), menuItemId: item.id, nome: item.nome, categoria: item.categoria,
      prezzoBase, qty,
      ingredientiRimossi: baseIngs.filter((i) => rimossi.has(i.id)).map((i) => ({ id: i.id, nome: i.nome })),
      ingredientiAggiunti: Array.from(aggiunti.values()).map((i) => ({ id: i.id, nome: i.nome, prezzo: parseFloat(i.prezzoAggiunta?.toString() ?? "0") })),
      noteItem: nota, prezzoTotaleItem: prezzoBase + prezzoExtra + supplementoImpasto,
      impasto: impastoScelto ? { id: impastoScelto.id, nome: impastoScelto.nome, supplemento: impastoScelto.supplemento } : undefined,
    });
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.55)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={onChiudi}>
      <div style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", margin: "0 auto", width: "100%", maxWidth: 720 }}
        onClick={(e) => e.stopPropagation()}>

        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)" }} />
        </div>

        <div style={{ padding: "12px 20px 14px", borderBottom: "1px solid var(--border-soft)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text)" }}>{item.nome}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{item.descrizione}</div>
            </div>
            <button onClick={onChiudi} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text-3)", width: 32, height: 32, borderRadius: "50%", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>✕</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {impasti.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.7, marginBottom: 8, fontWeight: 500 }}>Impasto</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button onClick={() => setImpastoId(null)} style={{ padding: "7px 14px", borderRadius: 20, fontSize: 12.5, cursor: "pointer", border: "1.5px solid", background: impastoId === null ? "var(--text)" : "#fff", color: impastoId === null ? "#fff" : "var(--text)", borderColor: impastoId === null ? "var(--text)" : "var(--border)" }}>Classico · incluso</button>
                {impasti.map((x) => (
                  <button key={x.id} onClick={() => setImpastoId(x.id)} style={{ padding: "7px 14px", borderRadius: 20, fontSize: 12.5, cursor: "pointer", border: "1.5px solid", background: impastoId === x.id ? "var(--text)" : "#fff", color: impastoId === x.id ? "#fff" : "var(--text)", borderColor: impastoId === x.id ? "var(--text)" : "var(--border)" }}>{x.nome} · +{euro(x.supplemento)}</button>
                ))}
              </div>
            </div>
          )}
          {baseIngs.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.7, marginBottom: 8, fontWeight: 500 }}>
                Tocca per rimuovere
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {baseIngs.map((ing) => {
                  const removed = rimossi.has(ing.id);
                  return (
                    <button key={ing.id} onClick={() => {
                      const n = new Set(rimossi); n.has(ing.id) ? n.delete(ing.id) : n.add(ing.id); setRimossi(n);
                    }} style={{
                      padding: "6px 13px", borderRadius: 20, fontSize: 12.5, border: "1px solid", cursor: "pointer",
                      background: removed ? "var(--danger-bg)" : "var(--accent-bg)",
                      borderColor: removed ? "var(--danger-border)" : "var(--accent-border)",
                      color: removed ? "var(--danger)" : "var(--accent-ink)",
                      textDecoration: removed ? "line-through" : "none",
                    }}>{ing.nome}</button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.7, marginBottom: 8, fontWeight: 500 }}>
              Aggiungi extra
            </div>
            <div style={{ position: "relative", marginBottom: 10 }}>
              <span style={{ position: "absolute", left: 12, top: 10, color: "var(--text-faint)", fontSize: 13 }}>⌕</span>
              <input
                style={{ ...fieldSt, paddingLeft: 34, background: "#fff" }}
                placeholder="Cerca ingrediente…"
                value={search} onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {extra.map((ing) => {
                const added = aggiunti.has(ing.id);
                const prezzo = parseFloat(ing.prezzoAggiunta?.toString() ?? "0");
                return (
                  <button key={ing.id} onClick={() => {
                    const n = new Map(aggiunti); n.has(ing.id) ? n.delete(ing.id) : n.set(ing.id, ing); setAggiunti(n);
                  }} style={{
                    padding: "6px 13px", borderRadius: 20, fontSize: 12.5, border: "1px solid", cursor: "pointer",
                    background: added ? "var(--accent-bg)" : "var(--surface-muted)",
                    borderColor: added ? "var(--accent-border)" : "var(--border)",
                    color: added ? "var(--accent-ink)" : "var(--text-3)",
                  }}>
                    {ing.nome}
                    {prezzo > 0 && <span className="num" style={{ fontSize: 11.5, marginLeft: 5 }}>+{euro(prezzo)}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <input style={fieldSt}
            placeholder="Note (es. ben cotta, senza sale…)" value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border-soft)", background: "var(--surface-muted)", paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", color: "var(--text)", fontSize: 16, cursor: "pointer" }}>−</button>
              <span className="num" style={{ fontSize: 15, fontWeight: 500, minWidth: 20, textAlign: "center" }}>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", color: "var(--text)", fontSize: 16, cursor: "pointer" }}>+</button>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text)" }}>{euro(totale)}</div>
              {prezzoExtra > 0 && <div className="num" style={{ fontSize: 11, color: "var(--text-muted)" }}>+{euro(prezzoExtra)} extra</div>}
            </div>
          </div>
          <button onClick={conferma} style={{ width: "100%", background: "var(--text)", color: "#fff", border: "none", padding: 14, borderRadius: 9, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
            Aggiungi al carrello
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── «Menù Combo»: prezzo fisso, la cassiera sceglie con il cliente le bibite (e le pizze speciali, dove previste) ──
function ComboModal({ item, menu, onConferma, onChiudi }: {
  item: any; menu: any[]; onConferma: (c: CartItem) => void; onChiudi: () => void;
}) {
  const cfg = leggiComboConfig(item.comboConfig)!;
  const perId = new Map(menu.map((m) => [m.id, m]));
  const fissi = cfg.componenti.flatMap((c) => Array<string>(c.qta).fill(perId.get(c.id)?.nome ?? "prodotto"));
  const bibiteOpz = menu.filter((m) => m.categoria === "bevande" && bevandaAmmessaInCombo(m.nome)).sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  const pizzeOpz = menu.filter((m) => m.categoria === "menu_speciale").sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  const [bibite, setBibite] = useState<Record<string, number>>({});
  const [pizze, setPizze] = useState<Record<string, number>>({});
  const [nota, setNota] = useState("");
  const [qty, setQty] = useState(1);
  const somma = (o: Record<string, number>) => Object.values(o).reduce((a, n) => a + n, 0);
  const nBibite = somma(bibite), nPizze = somma(pizze);
  const completo = nBibite === cfg.bibite && nPizze === cfg.pizzeSpeciali;
  const espandi = (o: Record<string, number>) => Object.entries(o).flatMap(([id, n]) => Array<string>(n).fill(id));
  const prezzo = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
  const mancano = [
    cfg.pizzeSpeciali > nPizze ? `${cfg.pizzeSpeciali - nPizze} ${cfg.pizzeSpeciali - nPizze === 1 ? "pizza" : "pizze"}` : "",
    cfg.bibite > nBibite ? `${cfg.bibite - nBibite} ${cfg.bibite - nBibite === 1 ? "bibita" : "bibite"}` : "",
  ].filter(Boolean).join(" e ");

  const cambia = (stato: Record<string, number>, set: (o: Record<string, number>) => void, id: string, delta: number, max: number) => {
    const nuovo = (stato[id] ?? 0) + delta;
    if (nuovo < 0 || (delta > 0 && somma(stato) >= max)) return;
    const copia = { ...stato };
    if (nuovo === 0) delete copia[id]; else copia[id] = nuovo;
    set(copia);
  };
  const btn: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", color: "var(--text)", fontSize: 15, cursor: "pointer" };
  const riga = (it: any, stato: Record<string, number>, set: (o: Record<string, number>) => void, max: number) => {
    const n = stato[it.id] ?? 0;
    const pieno = somma(stato) >= max;
    return (
      <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--border-soft)", background: n ? "var(--accent-bg-2)" : "#fff" }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: n ? 600 : 400, color: "var(--text)" }}>{it.nome}</span>
        {n > 0 && (<>
          <button onClick={() => cambia(stato, set, it.id, -1, max)} style={btn}>−</button>
          <span className="num" style={{ minWidth: 14, textAlign: "center", fontSize: 13, fontWeight: 600 }}>{n}</span>
        </>)}
        <button onClick={() => cambia(stato, set, it.id, 1, max)} disabled={pieno}
          style={{ ...btn, background: pieno ? "var(--border)" : "var(--accent)", border: "none", color: pieno ? "var(--text-faint)" : "var(--text)", cursor: pieno ? "default" : "pointer" }}>+</button>
      </div>
    );
  };
  const titolo = (testo: string, fatte: number, tot: number) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "16px 0 8px" }}>
      <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.7, fontWeight: 500 }}>{testo}</span>
      <span className="num" style={{ fontSize: 12, fontWeight: 600, color: fatte === tot ? "var(--accent-ink)" : "var(--text-muted)" }}>{fatte} di {tot}</span>
    </div>
  );

  const conferma = () => {
    const scelte = { bibite: espandi(bibite), pizze: espandi(pizze) };
    onConferma({
      cartId: crypto.randomUUID(), menuItemId: item.id, nome: item.nome, categoria: "combo",
      prezzoBase: prezzo, qty, ingredientiRimossi: [], ingredientiAggiunti: [], noteItem: nota.trim(), prezzoTotaleItem: prezzo,
      combo: {
        scelte,
        dettaglio: testoDettaglioCombo(fissi, { bibite: scelte.bibite.map((id) => perId.get(id)?.nome ?? ""), pizze: scelte.pizze.map((id) => perId.get(id)?.nome ?? "") }),
      },
    });
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.55)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={onChiudi}>
      <div style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", margin: "0 auto", width: "100%", maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}><div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)" }} /></div>
        <div style={{ padding: "12px 20px 14px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text)" }}>{item.nome}</div>
            <div className="num" style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2, fontWeight: 500 }}>{euro(prezzo)}</div>
          </div>
          <button onClick={onChiudi} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text-3)", width: 32, height: 32, borderRadius: "50%", fontSize: 14, cursor: "pointer", flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 16px" }}>
          <div style={{ background: "var(--surface-muted)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", marginTop: 12, fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)" }}>
            <strong style={{ color: "var(--text)" }}>Comprende:</strong>{" "}
            {[
              fissi.length ? fissi.join(", ") : "",
              cfg.pizzeSpeciali > 0 ? `${cfg.pizzeSpeciali} pizze speciali a scelta` : "",
              cfg.bibite > 0 ? `${cfg.bibite} ${cfg.bibite === 1 ? "bibita" : "bibite"} da 33cl a scelta` : "",
            ].filter(Boolean).join(" + ")}
          </div>
          {cfg.pizzeSpeciali > 0 && (<>
            {titolo("Pizze speciali", nPizze, cfg.pizzeSpeciali)}
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>{pizzeOpz.map((it) => riga(it, pizze, setPizze, cfg.pizzeSpeciali))}</div>
          </>)}
          {cfg.bibite > 0 && (<>
            {titolo(cfg.bibite === 1 ? "Bibita" : "Bibite", nBibite, cfg.bibite)}
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>{bibiteOpz.map((it) => riga(it, bibite, setBibite, cfg.bibite))}</div>
          </>)}
          <input style={{ ...fieldSt, marginTop: 14 }} placeholder="Note (es. senza ghiaccio…)" value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border-soft)", background: "var(--surface-muted)", paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}>
          {!completo && <div style={{ fontSize: 12.5, color: "var(--danger)", textAlign: "center", marginBottom: 10 }}>Manca da scegliere: {mancano}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ ...btn, width: 32, height: 32 }}>−</button>
              <span className="num" style={{ fontSize: 15, fontWeight: 500, minWidth: 20, textAlign: "center" }}>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} style={{ ...btn, width: 32, height: 32 }}>+</button>
            </div>
            <div className="num" style={{ marginLeft: "auto", fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text)" }}>{euro(prezzo * qty)}</div>
          </div>
          <button onClick={conferma} disabled={!completo} style={{ width: "100%", background: completo ? "var(--text)" : "var(--border)", color: completo ? "#fff" : "var(--text-faint)", border: "none", padding: 14, borderRadius: 9, fontSize: 14, fontWeight: 500, cursor: completo ? "pointer" : "default", fontFamily: "var(--font-ui)" }}>
            Aggiungi al carrello
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Promemoria per la cassiera: prima di confermare, se nel carrello non c'è un fritto / una bevanda, glielo ricorda
// con le stesse parole dell'app (le legge al cliente). Ogni domanda si fa una volta sola per ordine.
const DOMANDE: Record<string, { testo: string; sub: string }> = {
  fritti: { testo: "Vuoi aggiungere un fritto da sgranocchiare?", sub: "Olive ascolane, supplì, patatine…" },
  bevande: { testo: "Gradisci qualcosa da bere?", sub: "Acqua, bibite, birra…" },
};

// ── Modale scelta orario di consegna ────────────────────────────
function OrarioConsegnaModal({ oraConsegna, modConsegna, onSalva, onRimuovi, onChiudi }: {
  oraConsegna: string; modConsegna: string;
  onSalva: (ora: string, modalita: string) => void; onRimuovi: () => void; onChiudi: () => void;
}) {
  const [ora, setOra] = useState(oraConsegna);
  const [modalita, setModalita] = useState(modConsegna || "appena_possibile");

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.55)", zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onChiudi}>
      <div style={{ background: "var(--surface)", borderRadius: 20, display: "flex", flexDirection: "column", width: "100%", maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 16px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)", marginBottom: 14 }}>Orario di consegna</div>

          <label style={{ display: "block", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 6 }}>Orario comunicato al cliente</label>
          <input type="time" style={{ ...fieldSt, marginBottom: 14 }} value={ora} onChange={(e) => setOra(e.target.value)} />

          <label style={{ display: "block", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 6 }}>Modalità</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            {([["appena_possibile", "Appena possibile"], ["non_prima", "Non prima"]] as const).map(([val, label]) => (
              <button key={val} onClick={() => setModalita(val)} style={{
                flex: 1, padding: "10px", borderRadius: 9, border: "1px solid",
                fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)",
                background: modalita === val ? "var(--accent-bg-2)" : "#fff",
                borderColor: modalita === val ? "var(--accent-border)" : "var(--border)",
                color: modalita === val ? "var(--accent-ink)" : "var(--text-3)",
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, paddingBottom: "max(4px, env(safe-area-inset-bottom))" }}>
            {oraConsegna && (
              <button onClick={onRimuovi} style={{ background: "#fff", border: "1px solid var(--danger-border)", color: "var(--danger)", padding: "11px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5 }}>Rimuovi</button>
            )}
            <button onClick={() => ora && onSalva(ora, modalita)} disabled={!ora} style={{
              flex: 1, background: ora ? "var(--text)" : "var(--border)", color: ora ? "#fff" : "var(--text-faint)",
              border: "none", padding: "11px 16px", borderRadius: 9, fontSize: 13, fontWeight: 500,
              cursor: ora ? "pointer" : "default", fontFamily: "var(--font-ui)",
            }}>Salva</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Ricerca/creazione cliente (domicilio) ──────────────────────
interface ClienteTrovato {
  id: string; nome: string; cognome?: string | null;
  telefono?: string | null; indirizzoDefault?: string | null; note?: string | null;
  numeroOrdini?: number;
}

function CercaClienteModal({ onSeleziona, onChiudi }: {
  onSeleziona: (c: { nome: string; telefono: string; indirizzo: string; note: string }) => void;
  onChiudi: () => void;
}) {
  const [query, setQuery] = useState("");
  const [risultati, setRisultati] = useState<ClienteTrovato[]>([]);
  const [cercando, setCercando] = useState(false);
  const [nuovoAperto, setNuovoAperto] = useState(false);
  const [nuovoNome, setNuovoNome] = useState("");
  const [nuovoTelefono, setNuovoTelefono] = useState("");
  const [nuovoIndirizzo, setNuovoIndirizzo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setRisultati([]); setCercando(false); return; }
    setCercando(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/clienti?q=${encodeURIComponent(query.trim())}&limit=8`);
      setRisultati(res.ok ? await res.json() : []);
      setCercando(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  function scegli(c: ClienteTrovato) {
    onSeleziona({
      nome: [c.nome, c.cognome].filter(Boolean).join(" "),
      telefono: c.telefono ?? "",
      indirizzo: c.indirizzoDefault ?? "",
      note: c.note ?? "",
    });
  }

  async function salvaNuovo() {
    if (!nuovoNome.trim()) return;
    setSalvando(true);
    const res = await fetch("/api/clienti", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nuovoNome.trim(), telefono: nuovoTelefono.trim() || null, indirizzoDefault: nuovoIndirizzo.trim() || null }),
    });
    setSalvando(false);
    if (res.ok) {
      scegli(await res.json());
    } else if (res.status === 409) {
      // Telefono già presente: usa comunque il cliente esistente invece di bloccare.
      const data = await res.json();
      scegli(data.cliente);
    }
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.55)", zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onChiudi}>
      <div style={{ background: "var(--surface)", borderRadius: 20, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden", width: "100%", maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 10px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)", marginBottom: 14 }}>Cerca cliente</div>
          <input
            style={fieldSt} placeholder="Nome, telefono o via e civico…"
            value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
          />
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>
          {cercando && <div style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "8px 0" }}>Cerco…</div>}
          {!cercando && query.trim().length >= 2 && risultati.length === 0 && !nuovoAperto && (
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "8px 0" }}>Nessun cliente trovato.</div>
          )}
          {risultati.map((c) => (
            <button key={c.id} onClick={() => scegli(c)} style={{
              display: "block", width: "100%", textAlign: "left", background: "#fff",
              border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px",
              marginBottom: 8, cursor: "pointer", fontFamily: "var(--font-ui)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
                {[c.nome, c.cognome].filter(Boolean).join(" ")}
                {typeof c.numeroOrdini === "number" && c.numeroOrdini > 0 && (
                  <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> · {c.numeroOrdini} ordini</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {[c.telefono, c.indirizzoDefault, c.note].filter(Boolean).join(" — ") || "—"}
              </div>
            </button>
          ))}

          {!nuovoAperto ? (
            <button onClick={() => { setNuovoAperto(true); setNuovoNome(query); }} style={{
              display: "block", width: "100%", textAlign: "center", background: "var(--surface-muted)",
              border: "1px dashed var(--border)", color: "var(--text-2)", borderRadius: 10, padding: "10px 12px",
              marginBottom: 16, cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5,
            }}>+ Nuovo cliente</button>
          ) : (
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <input style={fieldSt} placeholder="Nome" value={nuovoNome} onChange={(e) => setNuovoNome(e.target.value)} />
              <input style={fieldSt} placeholder="Telefono" value={nuovoTelefono} onChange={(e) => setNuovoTelefono(e.target.value)} />
              <input style={fieldSt} placeholder="Via e civico" value={nuovoIndirizzo} onChange={(e) => setNuovoIndirizzo(e.target.value)} />
              <button onClick={salvaNuovo} disabled={!nuovoNome.trim() || salvando} style={{
                background: nuovoNome.trim() ? "var(--text)" : "var(--border)", color: nuovoNome.trim() ? "#fff" : "var(--text-faint)",
                border: "none", padding: "10px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 500,
                cursor: nuovoNome.trim() ? "pointer" : "default", fontFamily: "var(--font-ui)",
              }}>{salvando ? "Salvo…" : "Salva e usa"}</button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Contenuto carrello (condiviso desktop/mobile) ──────────────
const MESSAGGI_DOMICILIO = ["Resto a 50 euro", "Citofono rotto, chiamare", "Chiamare all'arrivo"];

function CartContents({ cart, setCart, canale, setCanale, tipo, setTipo, tavolo, setTavolo, clienteNome, setClienteNome, clienteTel, setClienteTel, clienteIndirizzo, setClienteIndirizzo, nomeCitofono, setNomeCitofono, note, setNote, costoConsegna, setCostoConsegna, oraConsegna, modConsegna, onApriOrario, onCercaCliente, noteDomicilio, setNoteDomicilio, metodoPagamento, setMetodoPagamento, onConferma, loading, justSent }: any) {
  const subtotale = cart.reduce((a: number, c: CartItem) => a + c.prezzoTotaleItem * c.qty, 0);
  const consegna = tipo === "domicilio" ? (parseFloat(costoConsegna) || 0) : 0;
  const totale = subtotale + consegna;
  return (
    <>
      {/* Campi ordine + lista prodotti: un'unica area scrollabile, così quando
          i campi del domicilio (orario, note, ecc.) si allungano non "spingono"
          fuori vista i prodotti già aggiunti al carrello — solo il riepilogo/
          conferma in fondo resta fisso. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10, borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {(["walk_in", "telefono"] as const).map((c) => (
            <button key={c} onClick={() => setCanale(c)} style={{
              flex: 1, padding: "9px", borderRadius: 9, border: "1px solid",
              fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)",
              background: canale === c ? "var(--text)" : "#fff",
              borderColor: canale === c ? "var(--text)" : "var(--border)",
              color: canale === c ? "#fff" : "var(--text-3)",
            }}>{c === "walk_in" ? "Walk-in" : "Telefono"}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["asporto", "domicilio", "tavolo"] as const).map((t) => (
            <button key={t} onClick={() => setTipo(t)} style={{
              flex: 1, padding: "7px", borderRadius: 8, border: "1px solid",
              fontSize: 11.5, cursor: "pointer", fontFamily: "var(--font-ui)", textTransform: "capitalize",
              background: tipo === t ? "var(--accent-bg-2)" : "transparent",
              borderColor: tipo === t ? "var(--accent-border)" : "var(--border)",
              color: tipo === t ? "var(--text)" : "var(--text-3)",
            }}>{t}</button>
          ))}
        </div>
        {tipo === "tavolo" && (
          <input style={{ ...fieldSt, borderColor: "var(--accent-border)", fontWeight: 600 }} placeholder="Tavolo * (numero o nome)" value={tavolo} onChange={(e: any) => setTavolo(e.target.value)} />
        )}
        {tipo === "domicilio" && (
          <button onClick={onCercaCliente} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%",
            background: "var(--accent-bg-2)", border: "1px solid var(--accent-border)", color: "var(--accent-ink)",
            padding: "9px 12px", borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)",
          }}>⌕ Cerca cliente</button>
        )}
        <input style={fieldSt} placeholder="Nome cliente" value={clienteNome} onChange={(e: any) => setClienteNome(e.target.value)} />
        <input style={fieldSt} placeholder="Telefono" value={clienteTel} onChange={(e: any) => setClienteTel(e.target.value)} />
        {tipo === "domicilio" && (
          <>
            <input style={fieldSt} placeholder="Indirizzo *" value={clienteIndirizzo} onChange={(e: any) => setClienteIndirizzo(e.target.value)} />
            <input style={fieldSt} placeholder="Nome sul citofono" value={nomeCitofono} onChange={(e: any) => setNomeCitofono(e.target.value)} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-2)", flex: 1 }}>Costo consegna</span>
              <div style={{ position: "relative", width: 90 }}>
                <span style={{ position: "absolute", left: 10, top: 9, color: "var(--text-muted)", fontSize: 12.5 }}>€</span>
                <input
                  type="number" step="0.10" min="0"
                  style={{ ...fieldSt, paddingLeft: 22, textAlign: "right" }}
                  value={costoConsegna}
                  onChange={(e: any) => setCostoConsegna(e.target.value)}
                />
              </div>
            </div>

            <button onClick={onApriOrario} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
              background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)",
              padding: "9px 12px", borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)",
            }}>
              <span>Orario di consegna</span>
              <span className="num" style={{ fontWeight: 500, color: oraConsegna ? "var(--text)" : "var(--text-faint)" }}>
                {oraConsegna ? `${modConsegna === "non_prima" ? "Non prima " : ""}${oraConsegna}` : "Non impostato"}
              </span>
            </button>

            <textarea style={{ ...fieldSt, resize: "none" } as any} rows={2} placeholder="Note per la consegna (es. citofono, piano...)"
              value={noteDomicilio} onChange={(e: any) => setNoteDomicilio(e.target.value)} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {MESSAGGI_DOMICILIO.map((msg) => (
                <button key={msg} onClick={() => setNoteDomicilio((p: string) => p.includes(msg) ? p : (p ? `${p}, ${msg}` : msg))} style={{
                  padding: "5px 11px", borderRadius: 20, fontSize: 11.5, cursor: "pointer", fontFamily: "var(--font-ui)",
                  border: "1px solid var(--border)", background: "var(--surface-muted)", color: "var(--text-3)",
                }}>{msg}</button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ padding: "14px 20px" }}>
        {cart.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 0", color: "var(--text-faint)", fontSize: 13 }}>
            Tocca una pizza dal menù per iniziare l'ordine
          </div>
        ) : cart.map((item: CartItem) => (
          <div key={item.cartId} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{item.nome}</div>
                {item.combo && <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.4 }}>{item.combo.dettaglio}</div>}
                <div className="num" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{euro(item.prezzoTotaleItem)} cad.</div>
                {item.impasto && <div style={{ fontSize: 11, color: "var(--text)", fontWeight: 600 }}>Impasto {item.impasto.nome} (+{euro(item.impasto.supplemento)})</div>}
                {item.ingredientiRimossi.length > 0 && <div style={{ fontSize: 11, color: "var(--danger)" }}>Senza: {item.ingredientiRimossi.map((i) => i.nome).join(", ")}</div>}
                {item.ingredientiAggiunti.length > 0 && <div style={{ fontSize: 11, color: "var(--accent-ink)" }}>Con: {item.ingredientiAggiunti.map((i) => i.nome).join(", ")}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <button onClick={() => setCart((p: CartItem[]) => { const ex = p.find((c) => c.cartId === item.cartId); if (!ex) return p; return ex.qty === 1 ? p.filter((c) => c.cartId !== item.cartId) : p.map((c) => c.cartId === item.cartId ? { ...c, qty: c.qty - 1 } : c); })}
                  style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)", background: "#fff", color: "var(--text)", fontSize: 14, cursor: "pointer" }}>−</button>
                <span className="num" style={{ fontSize: 13, minWidth: 16, textAlign: "center" }}>{item.qty}</span>
                <button onClick={() => setCart((p: CartItem[]) => p.map((c) => c.cartId === item.cartId ? { ...c, qty: c.qty + 1 } : c))}
                  style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)", background: "#fff", color: "var(--text)", fontSize: 14, cursor: "pointer" }}>+</button>
              </div>
              <span className="num" style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", minWidth: 56, textAlign: "right", flexShrink: 0 }}>{euro(item.prezzoTotaleItem * item.qty)}</span>
            </div>
          </div>
        ))}
        {cart.length > 0 && (
          <textarea style={{ ...fieldSt, resize: "none", marginTop: 4 } as any} rows={2} placeholder="Note ordine…" value={note} onChange={(e: any) => setNote(e.target.value)} />
        )}
      </div>
      </div>

      <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border-soft)", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["contanti", "pos"] as const).map((m) => (
            <button key={m} onClick={() => setMetodoPagamento(m)} style={{
              flex: 1, padding: "9px", borderRadius: 9, border: "1px solid",
              fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)",
              background: metodoPagamento === m ? "var(--text)" : "#fff",
              borderColor: metodoPagamento === m ? "var(--text)" : "var(--border)",
              color: metodoPagamento === m ? "#fff" : "var(--text-3)",
            }}>{m === "contanti" ? "Contanti" : "POS"}</button>
          ))}
        </div>
        {consegna > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Consegna</span>
            <span className="num" style={{ fontSize: 12.5, color: "var(--text-2)" }}>{euro(consegna)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Totale</span>
          <span className="num" style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--text)" }}>{euro(totale)}</span>
        </div>
        <button onClick={onConferma} disabled={loading || cart.length === 0} style={{
          width: "100%", border: "none", padding: 14, borderRadius: 9, fontSize: 13, fontWeight: 500,
          cursor: cart.length === 0 ? "default" : "pointer", fontFamily: "var(--font-ui)",
          background: justSent ? "var(--accent)" : cart.length === 0 ? "var(--border)" : "var(--text)",
          color: cart.length === 0 ? "var(--text-faint)" : "#fff",
        }}>
          {loading ? "Invio…" : justSent ? "✓ Ordine confermato" : "Conferma ordine"}
        </button>
      </div>
    </>
  );
}

// ── Pagina principale ────────────────────────────────────────
export default function NuovoOrdinePage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";

  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [ingredienti, setIngredienti] = useState<Ingrediente[]>([]);
  const [sedi, setSedi] = useState<any[]>([]);
  const [sedeSelezionata, setSede] = useState(user?.sedeId ?? "");
  const [catFiltro, setCatFiltro] = useState("pizze_rosse");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [canale, setCanale] = useState<"walk_in" | "telefono">("walk_in");
  const [tipo, setTipo] = useState<"asporto" | "domicilio" | "tavolo">("asporto");
  const [tavolo, setTavolo] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTel, setClienteTel] = useState("");
  const [clienteIndirizzo, setAddr] = useState("");
  const [nomeCitofono, setNomeCitofono] = useState("");
  const [costoConsegna, setCostoConsegna] = useState("1.50");
  const [note, setNote] = useState("");
  const [noteDomicilio, setNoteDomicilio] = useState("");
  const [oraConsegna, setOraConsegna] = useState("");
  const [modConsegna, setModConsegna] = useState("");
  const [metodoPagamento, setMetodoPagamento] = useState<"contanti" | "pos" | "">("");
  const [showOrarioModal, setShowOrarioModal] = useState(false);
  const [showCercaCliente, setShowCercaCliente] = useState(false);
  const [loading, setLoading] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [pizzaModal, setPizzaModal] = useState<any>(null);
  const [showCart, setShowCart] = useState(false);
  const [cercaPizza, setCercaPizza] = useState("");
  const [comboModal, setComboModal] = useState<any>(null);
  // Promemoria fritto/bevanda: quali domande sono già state fatte per questo ordine e quale è aperta ora.
  const [domandeFatte, setDomandeFatte] = useState<string[]>([]);
  const [domandaAperta, setDomandaAperta] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sedi").then((r) => r.json()).then((d) => {
      setSedi(Array.isArray(d) ? d : []);
      if (!sedeSelezionata && d.length > 0) setSede(d[0].id);
    });
  }, []);

  useEffect(() => {
    if (!sedeSelezionata) return;
    fetch(`/api/menu?sedeId=${sedeSelezionata}`).then((r) => r.json()).then((d) =>
      setMenuItems((d.items ?? []).filter((i: any) => i.isAttivo)));
    fetch(`/api/ingredienti?sedeId=${sedeSelezionata}`).then((r) => r.json()).then((d) =>
      setIngredienti(Array.isArray(d) ? d : []));
  }, [sedeSelezionata]);

  // In cassa "Speciali" viene dopo i calzoni; sul sito clienti (OrdinaFlow) è invece la prima sezione.
  const cats = ["pizze_rosse", "pizze_bianche", "calzoni", "focacce", "menu_speciale", "combo", "fritti", "dolci", "bevande", "extra"];
  const catsPresenti = cats.filter((c) => menuItems.some((m) => m.categoria === c));
  const isSezionePizze = catFiltro === "pizze_rosse" || catFiltro === "pizze_bianche";
  // In ordine alfabetico dentro ogni sezione, per leggere e cercare più in fretta.
  const itemsFiltrati = menuItems.filter((m) => m.categoria === catFiltro
    && (!isSezionePizze || m.nome.toLowerCase().includes(cercaPizza.toLowerCase())))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }));
  const cartQty = cart.reduce((a, c) => a + c.qty, 0);
  const subtotale = cart.reduce((a, c) => a + c.prezzoTotaleItem * c.qty, 0);
  const deliveryFee = tipo === "domicilio" ? (parseFloat(costoConsegna) || 0) : 0;
  const totale = subtotale + deliveryFee;
  const nomeSede = sedi.find((s) => s.id === sedeSelezionata)?.nome ?? "";
  // Prodotti attivi e non esauriti in questa sede: da qui si sceglie per i combo e si decide se un combo si può vendere.
  const disponibili = menuItems.filter((m) => m.disponibileInSede !== false);

  const handleClick = (item: any) => {
    if (item.disponibileInSede === false) return;
    if (item.categoria === "combo") { if (comboDisponibileIn(item, disponibili)) setComboModal(item); return; }
    const isPizza = ["menu_speciale", "pizze_rosse", "pizze_bianche", "calzoni", "focacce"].includes(item.categoria);
    if (isPizza) { setPizzaModal(item); return; }
    const prezzo = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
    setCart((prev) => {
      const ex = prev.find((c) => c.menuItemId === item.id && !c.ingredientiAggiunti.length && !c.ingredientiRimossi.length);
      if (ex) return prev.map((c) => c.cartId === ex.cartId ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { cartId: crypto.randomUUID(), menuItemId: item.id, nome: item.nome, categoria: item.categoria, prezzoBase: prezzo, qty: 1, ingredientiRimossi: [], ingredientiAggiunti: [], noteItem: "", prezzoTotaleItem: prezzo }];
    });
  };

  const prossimaDomanda = (chiesti: string[]) =>
    (["fritti", "bevande"] as const).find((cat) =>
      !chiesti.includes(cat) && !cart.some((c) => c.categoria === cat || c.categoria === "combo") && disponibili.some((m) => m.categoria === cat));

  // «Conferma ordine»: prima i controlli e, se manca un fritto o una bevanda, la domanda per il cliente; poi l'invio vero.
  const confermaOrdine = () => {
    if (!cart.length) return toast.error("Aggiungi almeno un prodotto");
    if (tipo === "tavolo" && !tavolo.trim()) return toast.error("Indica il tavolo (numero o nome)");
    const cat = prossimaDomanda(domandeFatte);
    if (cat) { setDomandaAperta(cat); return; }
    inviaOrdine();
  };
  // Sì: si apre la sezione del menù e la cassiera aggiunge (poi preme di nuovo «Conferma»). No: domanda successiva, infine l'invio.
  const rispondiDomanda = (cat: string, si: boolean) => {
    const fatte = [...domandeFatte, cat];
    setDomandeFatte(fatte);
    setDomandaAperta(null);
    if (si) { setCatFiltro(cat); setCercaPizza(""); setShowCart(false); return; }
    const prossima = prossimaDomanda(fatte);
    if (prossima) setDomandaAperta(prossima); else inviaOrdine();
  };

  const inviaOrdine = async () => {
    if (!cart.length) return toast.error("Aggiungi almeno un prodotto");
    if (tipo === "tavolo" && !tavolo.trim()) return toast.error("Indica il tavolo (numero o nome)");
    // Da telefono/tablet non si stampa: la comanda esce dal PC con la stampa automatica attiva.
    const stampaQui = typeof window !== "undefined" && window.innerWidth > 900;
    setLoading(true);
    let oraConsegnaISO: string | null = null;
    if (tipo === "domicilio" && oraConsegna) {
      const [h, m] = oraConsegna.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      oraConsegnaISO = d.toISOString();
    }
    const res = await fetch("/api/ordini", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sedeId: sedeSelezionata, canale, tipo,
        clienteNome: clienteNome || (tipo === "tavolo" ? `Tavolo ${tavolo.trim()}` : "Cliente anonimo"),
        tavolo: tipo === "tavolo" ? tavolo.trim() : null,
        stampato: stampaQui,
        clienteTelefono: clienteTel || null,
        clienteIndirizzo: tipo === "domicilio" ? clienteIndirizzo : null,
        nomeCitofono: tipo === "domicilio" ? (nomeCitofono || null) : null,
        note: note || null,
        noteDomicilio: tipo === "domicilio" ? (noteDomicilio || null) : null,
        oraConsegnaComunicata: oraConsegnaISO,
        modalitaConsegna: tipo === "domicilio" ? (modConsegna || null) : null,
        metodoPagamento: metodoPagamento || null,
        costoConsegna: deliveryFee,
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          nomeSnapshot: c.nome + (c.ingredientiAggiunti.length ? ` +${c.ingredientiAggiunti.map((i) => i.nome).join("+")}` : "") + (c.ingredientiRimossi.length ? ` -${c.ingredientiRimossi.map((i) => i.nome).join("-")}` : ""),
          quantita: c.qty,
          noteItem: [c.impasto ? `IMPASTO ${c.impasto.nome.toUpperCase()}` : "", c.ingredientiRimossi.length ? `Senza: ${c.ingredientiRimossi.map((i) => i.nome).join(", ")}` : "", c.ingredientiAggiunti.length ? `Con: ${c.ingredientiAggiunti.map((i) => i.nome).join(", ")}` : "", c.noteItem].filter(Boolean).join(" | ") || null,
          ingredientiRimossi: c.ingredientiRimossi.map((i) => i.id),
          ingredientiAggiuntiIds: c.ingredientiAggiunti.map((i) => i.id),
          impastoId: c.impasto?.id,
          ...(c.combo ? { comboScelte: c.combo.scelte } : {}),
        })),
      }),
    });
    setLoading(false);
    if (res.ok) {
      const ordine = await res.json();
      toast.success(`Ordine #${ordine.numeroOrdine} creato`);
      if (stampaQui) await stampaBrowser({
        numero: ordine.numeroOrdine, ordineId: ordine.id, sede: nomeSede, canale, tipo, tavolo: tipo === "tavolo" ? tavolo.trim() : undefined, cliente: clienteNome || (tipo === "tavolo" ? `Tavolo ${tavolo.trim()}` : "Cliente anonimo"), telefono: clienteTel, indirizzo: clienteIndirizzo,
        nomeCitofono: tipo === "domicilio" ? (nomeCitofono || undefined) : undefined,
        items: cart.map((c) => ({
          nome: c.nome, qty: c.qty, prezzo: c.prezzoTotaleItem,
          note: [
            c.combo?.dettaglio ?? "",
            c.impasto ? `IMPASTO ${c.impasto.nome.toUpperCase()}` : "",
            c.ingredientiRimossi.length ? `Senza: ${c.ingredientiRimossi.map((i) => i.nome).join(", ")}` : "",
            c.ingredientiAggiunti.length ? `Con: ${c.ingredientiAggiunti.map((i) => i.nome).join(", ")}` : "",
            c.noteItem,
          ].filter(Boolean).join(" | ") || undefined,
        })),
        totale, costoConsegna: deliveryFee, note,
        noteDomicilio: tipo === "domicilio" ? noteDomicilio : undefined,
        oraConsegnaComunicata: tipo === "domicilio" ? oraConsegna || undefined : undefined,
        modalitaConsegna: tipo === "domicilio" ? (modConsegna as any || undefined) : undefined,
        metodoPagamento: metodoPagamento || undefined,
        ora: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      });
      setJustSent(true);
      setTimeout(() => setJustSent(false), 1800);
      setDomandeFatte([]);
      setCart([]); setTavolo(""); setClienteNome(""); setClienteTel(""); setAddr(""); setNomeCitofono(""); setCostoConsegna("1.50"); setNote(""); setNoteDomicilio(""); setOraConsegna(""); setModConsegna(""); setMetodoPagamento(""); setShowCart(false);
    } else { toast.error("Errore nella creazione dell'ordine"); }
  };

  const cartProps = {
    cart, setCart, canale, setCanale, tipo, setTipo, tavolo, setTavolo, clienteNome, setClienteNome, clienteTel, setClienteTel,
    clienteIndirizzo, setClienteIndirizzo: setAddr, nomeCitofono, setNomeCitofono, note, setNote, costoConsegna, setCostoConsegna,
    oraConsegna, modConsegna, onApriOrario: () => setShowOrarioModal(true),
    onCercaCliente: () => setShowCercaCliente(true),
    noteDomicilio, setNoteDomicilio, metodoPagamento, setMetodoPagamento, onConferma: confermaOrdine, loading, justSent,
  };

  return (
    <div className="animate-in" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {isSuperAdmin && (
          <select value={sedeSelezionata} onChange={(e) => setSede(e.target.value)} style={{ ...fieldSt, background: "#fff", marginBottom: 12, width: 260 }}>
            {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        )}

        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
          {catsPresenti.map((c) => (
            <button key={c} onClick={() => { setCatFiltro(c); setCercaPizza(""); }} style={{
              flexShrink: 0, padding: "8px 15px", borderRadius: 20, fontSize: 12.5, cursor: "pointer",
              border: "1px solid", fontFamily: "var(--font-ui)", whiteSpace: "nowrap",
              background: catFiltro === c ? "var(--text)" : "#fff",
              borderColor: catFiltro === c ? "var(--text)" : "var(--border)",
              color: catFiltro === c ? "#fff" : "var(--text-3)",
            }}>{CAT_LABEL[c] ?? c}</button>
          ))}
        </div>

        {isSezionePizze && (
          <div style={{ position: "relative", marginBottom: 12 }}>
            <span style={{ position: "absolute", left: 12, top: 10, color: "var(--text-faint)", fontSize: 13 }}>⌕</span>
            <input
              style={{ ...fieldSt, paddingLeft: 34, background: "#fff" }}
              placeholder="Cerca pizza…"
              value={cercaPizza} onChange={(e) => setCercaPizza(e.target.value)}
            />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
          {itemsFiltrati.map((item) => {
            const prezzo = parseFloat(item.prezzoEffettivo ?? item.prezzoBase);
            const nInCart = cart.filter((c) => c.menuItemId === item.id).reduce((a, c) => a + c.qty, 0);
            const esaurito = item.disponibileInSede === false || (item.categoria === "combo" && !comboDisponibileIn(item, disponibili));
            return (
              <div key={item.id} onClick={() => handleClick(item)} style={{
                background: "#fff", border: `1px solid ${nInCart > 0 ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 12, padding: 14, cursor: esaurito ? "default" : "pointer", position: "relative",
                userSelect: "none", opacity: esaurito ? 0.55 : 1,
              }}>
                {nInCart > 0 && (
                  <div className="num" style={{ position: "absolute", top: 10, right: 10, background: "var(--text)", color: "#fff", width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500 }}>{nInCart}</div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text)" }}>{item.nome}</span>
                  <span className="num" style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", flexShrink: 0 }}>{euro(prezzo)}</span>
                </div>
                {item.descrizione && <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.45, marginTop: 6 }}>{item.descrizione}</div>}
                {esaurito && <div style={{ fontSize: 10.5, color: "var(--danger)", marginTop: 6 }}>{item.categoria === "combo" && item.disponibileInSede !== false ? "Non disponibile: manca un prodotto in sede" : "Esaurito in sede"}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Carrello desktop */}
      <div className="cart-desktop" style={{
        width: 352, flexShrink: 0, position: "sticky", top: 0,
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
        display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 52px)",
      }}>
        <CartContents {...cartProps} />
      </div>

      {/* FAB carrello mobile */}
      <div className="cart-mobile-fab" style={{ display: "none", position: "fixed", bottom: 80, left: 16, right: 16, zIndex: 100 }}>
        {cartQty > 0 && (
          <button onClick={() => setShowCart(true)} style={{
            width: "100%", background: "var(--text)", color: "#fff", border: "none",
            padding: "14px 18px", borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: "pointer",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>{cartQty} {cartQty === 1 ? "prodotto" : "prodotti"}</span>
            <span className="num" style={{ fontSize: 15 }}>{euro(totale)} →</span>
          </button>
        )}
      </div>

      {pizzaModal && (
        <PizzaModal item={pizzaModal} tuttiIngredienti={ingredienti} sedeId={sedeSelezionata}
          onConferma={(c) => { setCart((p) => [...p, c]); setPizzaModal(null); toast.success(`${c.nome} aggiunto`, { duration: 1000 }); }}
          onChiudi={() => setPizzaModal(null)} />
      )}
      {comboModal && (
        <ComboModal item={comboModal} menu={disponibili}
          onConferma={(c) => { setCart((p) => [...p, c]); setComboModal(null); toast.success(`${c.nome} aggiunto`, { duration: 1000 }); }}
          onChiudi={() => setComboModal(null)} />
      )}
      {domandaAperta && DOMANDE[domandaAperta] && createPortal(
        // Nessun «tocca fuori per chiudere»: una risposta accidentale potrebbe confermare l'ordine.
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, width: "100%", maxWidth: 400, padding: "22px 20px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--accent-ink)", textTransform: "uppercase", letterSpacing: 1.8, fontWeight: 600, marginBottom: 10 }}>Chiedi al cliente</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text)", lineHeight: 1.25 }}>{DOMANDE[domandaAperta].testo}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0 20px" }}>{DOMANDE[domandaAperta].sub}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => rispondiDomanda(domandaAperta, false)} style={{ flex: 1, padding: "14px 8px", borderRadius: 10, border: "1px solid var(--border)", background: "#fff", color: "var(--text-2)", fontSize: 14, cursor: "pointer", fontFamily: "var(--font-ui)" }}>No, grazie</button>
              <button onClick={() => rispondiDomanda(domandaAperta, true)} style={{ flex: 1, padding: "14px 8px", borderRadius: 10, border: "1px solid var(--text)", background: "var(--text)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-ui)" }}>Sì, aggiungo</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {showCart && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.55)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
          onClick={() => setShowCart(false)}>
          <div style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)" }} />
            </div>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)" }}>Carrello ({cart.length})</span>
              <button onClick={() => setShowCart(false)} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text-3)", width: 30, height: 30, borderRadius: "50%", fontSize: 13, cursor: "pointer" }}>✕</button>
            </div>
            <CartContents {...cartProps} />
          </div>
        </div>,
        document.body
      )}
      {showOrarioModal && (
        <OrarioConsegnaModal
          oraConsegna={oraConsegna} modConsegna={modConsegna}
          onSalva={(ora, modalita) => { setOraConsegna(ora); setModConsegna(modalita); setShowOrarioModal(false); }}
          onRimuovi={() => { setOraConsegna(""); setModConsegna(""); setShowOrarioModal(false); }}
          onChiudi={() => setShowOrarioModal(false)}
        />
      )}
      {showCercaCliente && (
        <CercaClienteModal
          onSeleziona={(c) => {
            setClienteNome(c.nome); setClienteTel(c.telefono); setAddr(c.indirizzo);
            if (c.note) setNoteDomicilio((p) => p.includes(c.note) ? p : (p ? `${p}, ${c.note}` : c.note));
            setShowCercaCliente(false);
          }}
          onChiudi={() => setShowCercaCliente(false)}
        />
      )}
    </div>
  );
}
