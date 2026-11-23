"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

type Ord = {
  id: string; numero: number; ora: string; sedeId: string; sede: string; tipo: string; canale: string; stato: string;
  totale: number; costoConsegna: number; metodo: string | null; cliente: string | null; indirizzo: string | null;
  riderId: string | null; riderNome: string | null; consegnaStato: string | null; consegnataAt: string | null;
};
type Rider = {
  riderId: string | null; nome: string; consegne: number; totale: number; costoConsegna: number; contanti: number; pos: number;
  contantiDaVersare: number; contantiNonChiusi: number; nonChiuse: number; ordini: Ord[];
};
type Conti = {
  data: string; sedeId: string | null; consegneOk: boolean;
  riderDisponibili: { id: string; nome: string; sedeId: string | null }[];
  domicilio: { totali: any; rider: Rider[] };
  asporto: { ordini: Ord[]; totale: number; perCanale: { canale: string; ordini: number; totale: number }[] } & { ordini_n?: number };
  tavolo: { ordini: Ord[]; totale: number };
  je: { ok: boolean; giaPagato: number; contanti: number; modificatoDa: string | null; modificatoAt: string | null };
  pizze: { ok: boolean; nostre: number; maxi: number; justEat: number; totale: number };
  totale: { domicilio: number; asporto: number; tavolo: number; justEat: number; totalone: number; contantiNoti: number; carteNote: number; ordiniInCorso: number };
  perSede: { sedeId: string; nome: string; domicilio: number; asporto: number; tavolo: number; justEatGiaPagato: number; justEatContanti: number; totale: number; pizzeNostre: number; pizzeJustEat: number; pizzeTotali: number }[] | null;
};

const euro = (n: number) => `€ ${(n ?? 0).toFixed(2).replace(".", ",")}`;
const ora = (d: string) => new Date(d).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });
const CANALE: Record<string, string> = { walk_in: "Cassa / banco", telefono: "Telefono", online: "App ordini" };

const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px" };
const etichetta: React.CSSProperties = { fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 600 };
const btn = (attivo: boolean): React.CSSProperties => ({
  padding: "8px 15px", borderRadius: 20, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)",
  border: `1px solid ${attivo ? "var(--text)" : "var(--border)"}`, background: attivo ? "var(--text)" : "#fff", color: attivo ? "#fff" : "var(--text-3)",
});

function Kpi({ titolo, valore, nota }: { titolo: string; valore: string; nota?: string }) {
  return (
    <div style={{ ...card, flex: "1 1 150px", minWidth: 0 }}>
      <div style={etichetta}>{titolo}</div>
      <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text)", marginTop: 4 }}>{valore}</div>
      {nota && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{nota}</div>}
    </div>
  );
}

function Riga({ a, b, forte, nota }: { a: string; b: string; forte?: boolean; nota?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "7px 0", borderTop: "1px solid var(--border-soft)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: forte ? 14 : 13, fontWeight: forte ? 600 : 400, color: "var(--text)" }}>{a}</div>
        {nota && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{nota}</div>}
      </div>
      <div className="num" style={{ fontSize: forte ? 16 : 13.5, fontWeight: forte ? 600 : 500, color: "var(--text)", flexShrink: 0 }}>{b}</div>
    </div>
  );
}

export default function ContiPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";

  const [giorno, setGiorno] = useState<string>("");
  const [sedi, setSedi] = useState<any[]>([]);
  const [sedeId, setSedeId] = useState("tutte");
  const [scheda, setScheda] = useState<"domicilio" | "asporto" | "totale">("domicilio");
  const [dati, setDati] = useState<Conti | null>(null);
  const [errore, setErrore] = useState("");
  const [aperti, setAperti] = useState<Record<string, boolean>>({});
  const [jeGia, setJeGia] = useState("");
  const [jeCont, setJeCont] = useState("");
  const [jePizze, setJePizze] = useState("");
  const [jeSalvando, setJeSalvando] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) fetch("/api/sedi").then((r) => r.json()).then((d) => Array.isArray(d) && setSedi(d));
  }, [isSuperAdmin]);

  const carica = useCallback(async () => {
    if (!user) return;
    const qs = new URLSearchParams();
    if (giorno) qs.set("data", giorno);
    if (isSuperAdmin) qs.set("sedeId", sedeId);
    const res = await fetch(`/api/conti?${qs}`);
    if (!res.ok) { setErrore((await res.json().catch(() => ({}))).error ?? "Errore nel caricamento"); return; }
    setErrore("");
    const d: Conti = await res.json();
    setDati(d);
    if (!giorno) setGiorno(d.data);
    setJeGia(d.je.giaPagato ? String(d.je.giaPagato).replace(".", ",") : "");
    setJeCont(d.je.contanti ? String(d.je.contanti).replace(".", ",") : "");
    setJePizze(d.pizze?.justEat ? String(d.pizze.justEat) : "");
  }, [user, giorno, sedeId, isSuperAdmin]);

  useEffect(() => { carica(); }, [carica]);

  // La serata di oggi si aggiorna da sola ogni minuto.
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) carica(); }, 60000);
    return () => clearInterval(t);
  }, [carica]);

  // Caso eccezionale: il cliente deve pagare con il metodo scelto (lo scontrino è già emesso). Cambiarlo obbliga a rifare lo scontrino.
  async function correggiMetodo(o: Ord, metodo: "contanti" | "pos") {
    if (o.metodo === metodo) return;
    const scelto = o.metodo === "pos" ? "POS" : o.metodo === "contanti" ? "contanti" : "nessun metodo";
    const nuovo = metodo === "pos" ? "POS" : "contanti";
    if (!confirm(`Il cliente aveva scelto: ${scelto}.

Cambiare in ${nuovo} è un caso eccezionale: lo scontrino già emesso va annullato e rifatto per l'importo giusto.

Confermi la correzione dell'ordine #${o.numero}?`)) return;
    const res = await fetch("/api/conti/metodo", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ordineId: o.id, metodo }) });
    if (res.ok) { toast.success(`Ordine #${o.numero}: pagato ${metodo === "pos" ? "con POS" : "in contanti"}`); carica(); }
    else toast.error((await res.json().catch(() => ({}))).error ?? "Non riesco a correggere");
  }

  async function assegnaRider(o: Ord, fattorinoId: string) {
    if (!fattorinoId) return;
    const res = await fetch("/api/conti/assegna", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ordineId: o.id, fattorinoId }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast.success(`Ordine #${o.numero} assegnato a ${d.rider}${d.chiusa ? "" : ": lo vede nella sua app"}`); carica(); }
    else toast.error(d.error ?? "Non riesco ad assegnare il rider");
  }

  async function salvaJe() {
    if (!dati?.sedeId) return;
    setJeSalvando(true);
    const res = await fetch("/api/conti/je", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sedeId: dati.sedeId, data: dati.data, giaPagato: jeGia || "0", contanti: jeCont || "0", pizze: jePizze || "0" }),
    });
    setJeSalvando(false);
    if (res.ok) { toast.success("Incasso Just Eat salvato"); carica(); }
    else toast.error((await res.json().catch(() => ({}))).error ?? "Non riesco a salvare");
  }

  function spostaGiorno(delta: number) {
    if (!giorno) return;
    const [y, m, d] = giorno.split("-").map(Number);
    const n = new Date(Date.UTC(y, m - 1, d + delta));
    setGiorno(n.toISOString().slice(0, 10));
  }

  const tot = dati?.domicilio.totali;
  const unaSede = !!dati?.sedeId;
  const nomeSede = unaSede ? (sedi.find((s) => s.id === dati?.sedeId)?.nome ?? user?.sedeNome ?? "") : "Tutte le sedi";

  const rigaOrdine = (o: Ord, conMetodo: boolean) => (
    <div key={o.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid var(--border-soft)", fontSize: 12.5 }}>
      <span className="num" style={{ fontWeight: 600, minWidth: 44 }}>#{o.numero}</span>
      <span className="num" style={{ color: "var(--text-muted)", minWidth: 38 }}>{ora(o.ora)}</span>
      <span style={{ flex: "1 1 160px", minWidth: 0, color: "var(--text-2)" }}>
        {o.cliente ?? "—"}{o.indirizzo ? ` · ${o.indirizzo}` : ""}{!unaSede ? ` · ${o.sede.replace("Don Basilico ", "")}` : ""}
      </span>
      {o.tipo === "domicilio" && o.riderId && o.consegnaStato !== "consegnata" && (
        <span title="Il rider ha scansionato ma non ha chiuso la consegna" style={{ fontSize: 10.5, color: "var(--danger)", border: "1px solid var(--danger-border)", borderRadius: 10, padding: "1px 7px" }}>non chiusa</span>
      )}
      <span className="num" style={{ fontWeight: 600, minWidth: 70, textAlign: "right" }}>{euro(o.totale)}</span>
      {o.tipo === "domicilio" && (!o.riderId || (o.consegnaStato && o.consegnaStato !== "consegnata")) && (() => {
        const scelte = (dati?.riderDisponibili ?? []).filter((r) => !r.sedeId || r.sedeId === o.sedeId);
        return (
          <select value="" onChange={(e) => assegnaRider(o, e.target.value)} aria-label="Assegna a un rider"
            style={{ padding: "3px 6px", borderRadius: 10, fontSize: 11, border: "1px solid var(--border)", background: "#fff", fontFamily: "var(--font-ui)", maxWidth: 130 }}>
            <option value="">{o.riderId ? "Cambia rider…" : "Assegna a…"}</option>
            {scelte.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        );
      })()}
      {conMetodo && (
        <span style={{ display: "inline-flex", gap: 4 }}>
          {(["contanti", "pos"] as const).map((m) => (
            <button key={m} onClick={() => correggiMetodo(o, m)} title="Solo caso eccezionale: lo scontrino già emesso va rifatto"
              style={{
                padding: "3px 9px", borderRadius: 10, fontSize: 11, cursor: "pointer", fontFamily: "var(--font-ui)",
                border: `1px solid ${o.metodo === m ? "var(--text)" : "var(--border)"}`, background: o.metodo === m ? "var(--text)" : "#fff", color: o.metodo === m ? "#fff" : "var(--text-3)",
              }}>{m === "pos" ? "POS" : "Contanti"}</button>
          ))}
        </span>
      )}
    </div>
  );

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* FILTRI */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => spostaGiorno(-1)} style={btn(false)} aria-label="Giorno prima">‹</button>
          <input type="date" value={giorno} onChange={(e) => e.target.value && setGiorno(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13, fontFamily: "var(--font-ui)", background: "#fff" }} />
          <button onClick={() => spostaGiorno(1)} style={btn(false)} aria-label="Giorno dopo">›</button>
          <button onClick={() => setGiorno("")} style={btn(false)}>Oggi</button>
        </div>
        {isSuperAdmin && (
          <select value={sedeId} onChange={(e) => setSedeId(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13, fontFamily: "var(--font-ui)", background: "#fff" }}>
            <option value="tutte">Tutte le sedi</option>
            {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        )}
        {!isSuperAdmin && user?.sedeNome && <span style={{ fontSize: 13, color: "var(--text-2)" }}>{user.sedeNome}</span>}
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Serata dalle 5:00 alle 5:00 del giorno dopo</span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={() => setScheda("domicilio")} style={btn(scheda === "domicilio")}>Domicilio</button>
        <button onClick={() => setScheda("asporto")} style={btn(scheda === "asporto")}>Asporto</button>
        <button onClick={() => setScheda("totale")} style={btn(scheda === "totale")}>Totale serata</button>
      </div>

      {errore && <div style={{ color: "var(--danger)", fontSize: 13 }}>{errore}</div>}
      {!dati && !errore && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Carico i conti…</div>}

      {dati && dati.totale.ordiniInCorso > 0 && (
        <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
          {dati.totale.ordiniInCorso === 1 ? "1 ordine è ancora in lavorazione" : `${dati.totale.ordiniInCorso} ordini sono ancora in lavorazione`}: è già contato nei totali.
        </div>
      )}

      {/* ───────────────────────── DOMICILIO ───────────────────────── */}
      {dati && scheda === "domicilio" && tot && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Kpi titolo="Incasso domicilio" valore={euro(tot.totale)} nota={`${tot.ordini} consegne`} />
            <Kpi titolo="Contanti" valore={euro(tot.contanti)} nota="incassati dai rider" />
            <Kpi titolo="POS" valore={euro(tot.pos)} nota="carta al rider" />
            <Kpi titolo="Costo consegna" valore={euro(tot.costoConsegna)} nota="già dentro l'incasso, è della pizzeria" />
          </div>

          {!dati.consegneOk && (
            <div style={{ ...card, color: "var(--danger)", fontSize: 12.5 }}>Non riesco a leggere le consegne dei rider: i totali sono giusti, ma non so quale rider ha consegnato.</div>
          )}
          {tot.senzaMetodo > 0 && (
            <div style={{ ...card, fontSize: 12.5, color: "var(--danger)" }}>{euro(tot.senzaMetodo)} di consegne senza metodo di pagamento: controlla gli ordini qui sotto.</div>
          )}

          <div style={{ ...card, padding: "6px 16px 10px" }}>
            <div style={{ ...etichetta, padding: "10px 0 6px" }}>Per rider</div>
            {dati.domicilio.rider.length === 0 && <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>Nessuna consegna in questa serata.</div>}
            {dati.domicilio.rider.map((g) => {
              const chiave = g.riderId ?? "nessuno";
              const aperto = aperti[chiave] ?? chiave === "nessuno";
              return (
                <div key={chiave} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <button onClick={() => setAperti((p) => ({ ...p, [chiave]: !(p[chiave] ?? chiave === "nessuno") }))}
                    style={{ width: "100%", background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: "12px 0", fontFamily: "var(--font-ui)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: g.riderId ? "var(--text)" : "var(--danger)" }}>{aperto ? "▾" : "▸"} {g.nome}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{g.consegne} {g.consegne === 1 ? "consegna" : "consegne"} · {euro(g.totale)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 6, fontSize: 12.5 }}>
                      {g.riderId ? (
                        <span>Da versare in contanti: <strong className="num" style={{ fontSize: 15 }}>{euro(g.contantiDaVersare)}</strong></span>
                      ) : (
                        <span>Contanti: <strong className="num">{euro(g.contanti)}</strong> (nessun rider ha scansionato il QR)</span>
                      )}
                      <span>POS: <strong className="num">{euro(g.pos)}</strong></span>
                      {g.riderId && g.contantiNonChiusi > 0 && (
                        <span style={{ color: "var(--danger)" }}>Contanti di consegne non chiuse: <strong className="num">{euro(g.contantiNonChiusi)}</strong> ({g.nonChiuse})</span>
                      )}
                    </div>
                  </button>
                  {aperto && <div style={{ paddingBottom: 8 }}>{g.ordini.map((o) => rigaOrdine(o, true))}</div>}
                </div>
              );
            })}
            <div style={{ borderTop: "2px solid var(--text)", marginTop: 4, paddingTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                <span style={{ fontSize: 14.5, fontWeight: 700 }}>Totale tutte le consegne</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{tot.ordini} consegne · {euro(tot.totale)}</span>
              </div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 6, fontSize: 12.5 }}>
                <span>Contanti da versare: <strong className="num" style={{ fontSize: 15 }}>{euro(tot.contantiDaVersare)}</strong></span>
                <span>Contanti totali: <strong className="num">{euro(tot.contanti)}</strong></span>
                <span>POS: <strong className="num">{euro(tot.pos)}</strong></span>
                {tot.contantiNonChiusi > 0 && <span style={{ color: "var(--danger)" }}>Non chiusi o senza rider: <strong className="num">{euro(tot.contantiNonChiusi)}</strong></span>}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
            «Da versare» conta i contanti delle consegne che il rider ha chiuso nella sua app. Se nessun rider ha scansionato il QR, scegli <strong>Assegna a…</strong> sull'ordine. Il cliente deve pagare con il metodo scelto (lo scontrino è già emesso): i tasti <strong>Contanti / POS</strong> servono solo nei casi eccezionali.
          </div>
        </>
      )}

      {/* ───────────────────────── ASPORTO ───────────────────────── */}
      {dati && scheda === "asporto" && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Kpi titolo="Incasso asporto" valore={euro(dati.asporto.totale)} nota={`${dati.asporto.ordini.length} ordini`} />
            <Kpi titolo="Scontrino medio" valore={euro(dati.asporto.ordini.length ? dati.asporto.totale / dati.asporto.ordini.length : 0)} />
            <Kpi titolo="Tavolo" valore={euro(dati.tavolo.totale)} nota={`${dati.tavolo.ordini.length} ordini · riga a parte`} />
          </div>
          <div style={{ ...card, padding: "6px 16px 10px" }}>
            <div style={{ ...etichetta, padding: "10px 0 2px" }}>Per provenienza</div>
            {dati.asporto.perCanale.map((c) => <Riga key={c.canale} a={CANALE[c.canale] ?? c.canale} nota={`${c.ordini} ordini`} b={euro(c.totale)} />)}
            <Riga a="Totale asporto" b={euro(dati.asporto.totale)} forte />
            <Riga a="Tavolo (a parte)" nota={`${dati.tavolo.ordini.length} ordini`} b={euro(dati.tavolo.totale)} />
          </div>
          <div style={{ ...card, padding: "6px 16px 10px" }}>
            <div style={{ ...etichetta, padding: "10px 0 6px" }}>Ordini asporto</div>
            {dati.asporto.ordini.length === 0 && <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>Nessun ordine d'asporto.</div>}
            {dati.asporto.ordini.map((o) => rigaOrdine(o, false))}
          </div>
          {dati.tavolo.ordini.length > 0 && (
            <div style={{ ...card, padding: "6px 16px 10px" }}>
              <div style={{ ...etichetta, padding: "10px 0 6px" }}>Ordini al tavolo</div>
              {dati.tavolo.ordini.map((o) => rigaOrdine(o, false))}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Per l'asporto il CRM non registra se il cliente ha pagato in contanti o con carta: qui vedi solo i totali.</div>
        </>
      )}

      {/* ───────────────────────── TOTALE SERATA ───────────────────────── */}
      {dati && scheda === "totale" && (
        <>
          <div style={{ ...card, padding: "8px 16px 12px" }}>
            <div style={{ ...etichetta, padding: "8px 0 2px" }}>{nomeSede} · {new Date(dati.data + "T12:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</div>
            <Riga a="Domicilio" nota={`${tot?.ordini ?? 0} consegne · contanti ${euro(tot?.contanti ?? 0)} · POS ${euro(tot?.pos ?? 0)}`} b={euro(dati.totale.domicilio)} />
            <Riga a="Asporto" nota={`${dati.asporto.ordini.length} ordini`} b={euro(dati.totale.asporto)} />
            <Riga a="Tavolo" nota={`${dati.tavolo.ordini.length} ordini`} b={euro(dati.totale.tavolo)} />

            {/* Just Eat: inserito a mano */}
            <div style={{ borderTop: "1px solid var(--border-soft)", padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13 }}>Just Eat</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    {unaSede ? "Inseriscilo a mano a fine serata" : "Somma delle sedi (si inserisce dentro ogni sede)"}
                    {dati.je.modificatoDa && dati.je.modificatoAt ? ` · salvato da ${dati.je.modificatoDa} alle ${ora(dati.je.modificatoAt)}` : ""}
                  </div>
                </div>
                <div className="num" style={{ fontSize: 13.5, fontWeight: 500 }}>{euro(dati.totale.justEat)}</div>
              </div>
              {!dati.je.ok && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>La riga Just Eat non è ancora attiva: manca la tabella nel database.</div>}
              {unaSede && dati.je.ok && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8, alignItems: "flex-end" }}>
                  <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 }}>
                    Già pagato (carta online)
                    <input inputMode="decimal" placeholder="0,00" value={jeGia} onChange={(e) => setJeGia(e.target.value)}
                      style={{ width: 130, padding: "8px 10px", borderRadius: 9, border: "1px solid var(--border)", fontSize: 14, fontFamily: "var(--font-ui)" }} />
                  </label>
                  <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 }}>
                    Contanti
                    <input inputMode="decimal" placeholder="0,00" value={jeCont} onChange={(e) => setJeCont(e.target.value)}
                      style={{ width: 130, padding: "8px 10px", borderRadius: 9, border: "1px solid var(--border)", fontSize: 14, fontFamily: "var(--font-ui)" }} />
                  </label>
                  <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 }}>
                    N. pizze Just Eat
                    <input inputMode="numeric" placeholder="0" value={jePizze} onChange={(e) => setJePizze(e.target.value.replace(/\D/g, ""))}
                      style={{ width: 110, padding: "8px 10px", borderRadius: 9, border: "1px solid var(--border)", fontSize: 14, fontFamily: "var(--font-ui)" }} />
                  </label>
                  <button onClick={salvaJe} disabled={jeSalvando} style={{ ...btn(true), padding: "9px 18px" }}>{jeSalvando ? "Salvo…" : "Salva Just Eat"}</button>
                </div>
              )}
            </div>

            <div style={{ borderTop: "2px solid var(--text)", marginTop: 2, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>TOTALE INCASSATO</span>
              <span className="num" style={{ fontFamily: "var(--font-display)", fontSize: 28 }}>{euro(dati.totale.totalone)}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <Riga a="Di cui contanti noti" nota="domicilio in contanti + Just Eat contanti" b={euro(dati.totale.contantiNoti)} />
              <Riga a="Di cui carte note" nota="POS del domicilio + Just Eat già pagato" b={euro(dati.totale.carteNote)} />
            </div>
            <div style={{ borderTop: "1px solid var(--border-soft)", marginTop: 10, paddingTop: 8 }}>
              <div style={{ ...etichetta, padding: "2px 0" }}>Pizze della serata</div>
              <Riga a="Pizze nostre" nota={dati.pizze.maxi ? `di cui ${dati.pizze.maxi} maxi (contate come 1)` : "Tutti i canali, maxi e combo compresi"} b={String(dati.pizze.nostre)} />
              <Riga a="Pizze Just Eat" nota={dati.pizze.ok ? "Inserite a mano qui sopra" : "Non ancora attivo: manca la colonna nel database"} b={String(dati.pizze.justEat)} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>PIZZE TOTALI</span>
                <span className="num" style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>{dati.pizze.totale}</span>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>Asporto e tavolo non sono divisi per metodo di pagamento: per questo contanti e carte «noti» non arrivano al totale.</div>
          </div>

          {dati.perSede && (
            <div style={{ ...card, padding: "6px 16px 12px", overflowX: "auto" }}>
              <div style={{ ...etichetta, padding: "10px 0 6px" }}>Sede per sede</div>
              <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ textAlign: "right", color: "var(--text-muted)", fontSize: 11 }}>
                    <th style={{ textAlign: "left", padding: "4px 0", fontWeight: 600 }}>Sede</th>
                    <th style={{ fontWeight: 600 }}>Domicilio</th><th style={{ fontWeight: 600 }}>Asporto</th><th style={{ fontWeight: 600 }}>Tavolo</th>
                    <th style={{ fontWeight: 600 }}>Just Eat</th><th style={{ fontWeight: 600 }}>Totale</th><th style={{ fontWeight: 600 }}>Pizze</th>
                  </tr>
                </thead>
                <tbody>
                  {dati.perSede.map((s) => (
                    <tr key={s.sedeId} style={{ textAlign: "right", borderTop: "1px solid var(--border-soft)" }}>
                      <td style={{ textAlign: "left", padding: "7px 0" }}>
                        <button onClick={() => setSedeId(s.sedeId)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text)", fontSize: 12.5, fontFamily: "var(--font-ui)", textDecoration: "underline", padding: 0 }}>
                          {s.nome.replace("Don Basilico ", "")}
                        </button>
                      </td>
                      <td className="num">{euro(s.domicilio)}</td><td className="num">{euro(s.asporto)}</td><td className="num">{euro(s.tavolo)}</td>
                      <td className="num">{euro(s.justEatGiaPagato + s.justEatContanti)}</td><td className="num" style={{ fontWeight: 600 }}>{euro(s.totale)}</td><td className="num">{s.pizzeTotali}</td>
                    </tr>
                  ))}
                  <tr style={{ textAlign: "right", borderTop: "2px solid var(--text)", fontWeight: 700 }}>
                    <td style={{ textAlign: "left", padding: "8px 0" }}>TOTALE</td>
                    <td className="num">{euro(dati.totale.domicilio)}</td><td className="num">{euro(dati.totale.asporto)}</td><td className="num">{euro(dati.totale.tavolo)}</td>
                    <td className="num">{euro(dati.totale.justEat)}</td><td className="num">{euro(dati.totale.totalone)}</td><td className="num">{dati.pizze.totale}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
