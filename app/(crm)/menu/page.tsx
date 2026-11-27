"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { ALLERGENI } from "@/lib/allergeni";

const CAT_LABEL: Record<string, string> = {
  pizze: "Pizze", pizze_rosse: "Pizze rosse", pizze_bianche: "Pizze bianche",
  calzoni: "Calzoni", fritti: "Fritti", bevande: "Bevande", dolci: "Dolci",
  extra: "Extra", menu_speciale: "Speciali", focacce: "Focacce", combo: "Menù Combo",
};

const fieldSt: React.CSSProperties = {
  width: "100%", background: "var(--surface-muted)", border: "1px solid var(--border)",
  color: "var(--text)", padding: "9px 12px", borderRadius: 9, fontSize: 12.5, outline: "none", fontFamily: "var(--font-ui)",
};
const labelSt: React.CSSProperties = {
  display: "block", fontSize: 10, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1.6,
};

function euro(n: number) {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

const FORM_VUOTO = {
  nome: "", descrizione: "", categoria: "pizze_rosse", prezzoBase: "", prezzoOnline: "",
  ingredientiIds: [] as string[], allergeniExtra: [] as string[], allergeniControllati: false,
};

// Il modulo parte dai dati di un prodotto: per modificarlo, oppure per fare la «versione della sede» di uno comune.
const formDa = (item: any) => ({
  nome: item.nome, descrizione: item.descrizione ?? "", categoria: item.categoria,
  prezzoBase: item.prezzoBase.toString(), prezzoOnline: item.prezzoOnline != null ? item.prezzoOnline.toString() : "",
  ingredientiIds: (item.ingredienti ?? []).map((i: any) => i.ingredienteId) as string[],
  allergeniExtra: (item.allergeniExtra ?? []) as string[], allergeniControllati: !item.allergeniDaVerificare,
});

// Per ogni prodotto, in ogni sede, due interruttori separati (vedi lib/esauriti.ts):
//  - «Attiva» / «Disattivata»: permanente, lo gestisce liberamente ogni sede;
//  - «Esaurito»: vale fino alle 5:00 del giorno dopo, poi il prodotto torna disponibile da solo.
const inVendita = (item: any): boolean => item.attivoInSede ?? item.disponibileInSede;
// Prezzo che vede il cliente nell'app: quello personalizzato della sede, altrimenti il prezzo app, altrimenti quello di cassa
// (stesse regole di GET /api/menu?canale=online).
const prezzoApp = (item: any): number =>
  parseFloat(item.override?.prezzoCustom || item.prezzoOnline || item.prezzoBase);

export default function MenuPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<any[]>([]);
  const [sedi, setSedi] = useState<any[]>([]);
  const [sedeVista, setSedeVista] = useState("");
  const [catFiltro, setCatFiltro] = useState("tutti");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState(FORM_VUOTO);
  // Prodotto comune di cui la sede sta facendo la propria versione (e se va nascosto quello comune).
  const [copiaDi, setCopiaDi] = useState<any>(null);
  const [nascondiComune, setNascondiComune] = useState(true);
  const [ingredienti, setIngredienti] = useState<any[]>([]);
  const [cercaIng, setCercaIng] = useState("");
  const [salvando, setSalvando] = useState(false);
  // La descrizione è stata scritta a mano in questa finestra: allora non si cambia più da sola.
  const [descScritta, setDescScritta] = useState(false);
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";
  const sedeId = isSuperAdmin ? sedeVista : user?.sedeId;

  useEffect(() => {
    if (isSuperAdmin) fetch("/api/sedi").then((r) => r.json()).then((d) => setSedi(Array.isArray(d) ? d : []));
  }, [isSuperAdmin]);

  // Il super admin li legge tutti; chi lavora in una sede i comuni più i propri.
  useEffect(() => {
    if (!user) return;
    const url = isSuperAdmin ? "/api/ingredienti" : `/api/ingredienti?sedeId=${user.sedeId}`;
    fetch(url).then((r) => r.json()).then((d) => setIngredienti(Array.isArray(d) ? d : []));
  }, [user?.ruolo, user?.sedeId]);

  const mio = (item: any) => !isSuperAdmin && !!item.sedeId && item.sedeId === user?.sedeId;

  // Un prodotto comune può avere solo ingredienti comuni; quello di una sede anche i suoi.
  const sedeDelProdotto = editItem ? editItem.sedeId : isSuperAdmin ? null : user?.sedeId;
  const ingredientiUsabili = ingredienti.filter((i) => !i.sedeId || i.sedeId === sedeDelProdotto);

  const apri = (modifica: any, copia: any = null) => {
    setEditItem(modifica); setCopiaDi(copia); setNascondiComune(true); setCercaIng("");
    setDescScritta(false);
    // La versione della sede: il prezzo app non si copia (vale quello di cassa) e gli allergeni vanno ricontrollati.
    setForm(modifica ? formDa(modifica) : copia ? { ...formDa(copia), prezzoOnline: "", allergeniControllati: false } : { ...FORM_VUOTO });
    setShowModal(true);
  };

  const elimina = async (item: any) => {
    if (!confirm(`Eliminare «${item.nome}» dal menù della vostra pizzeria?`)) return;
    const res = await fetch(`/api/menu/${item.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Prodotto eliminato"); caricaMenu(); }
    else toast.error("Operazione non riuscita");
  };

  const caricaMenu = async () => {
    // Finché non si sa chi è collegato non si carica niente (altrimenti, per un attimo, la lista sarebbe quella sbagliata).
    if (!user) return;
    const url = sedeId ? `/api/menu?sedeId=${sedeId}&tutti=1` : "/api/menu?tutti=1";
    const res = await fetch(url);
    const data = await res.json();
    // Un prodotto eliminato dalla sede non si rivede più nella sua lista.
    setItems((data.items ?? []).filter((i: any) => isSuperAdmin || !i.sedeId || i.isAttivo));
  };

  useEffect(() => { caricaMenu(); }, [sedeId, user?.ruolo]);

  const cats = ["tutti", ...Array.from(new Set(items.map((m) => m.categoria)))] as string[];
  const itemsFiltrati = items.filter((m) => catFiltro === "tutti" || m.categoria === catFiltro);

  // «Attiva» / «Disattivata» (permanente, solo questa sede). Disattivarla toglie anche un eventuale «Esaurito».
  const toggleInVendita = async (item: any) => {
    if (!sedeId) return;
    const nuovo = !inVendita(item);
    const res = await fetch(`/api/menu/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sedeId, disponibile: nuovo }),
    });
    if (res.ok) { toast.success(nuovo ? "Prodotto attivo in questa sede" : "Prodotto disattivato in questa sede (resta così finché non lo riattivi)"); caricaMenu(); }
    else toast.error("Operazione non riuscita");
  };

  // «Esaurito»: nascosto ai clienti fino alle 5:00 del giorno dopo, poi torna disponibile da solo. Si può togliere subito.
  const toggleEsaurito = async (item: any) => {
    if (!sedeId) return;
    const nuovo = !item.esauritoOggi;
    const res = await fetch(`/api/menu/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sedeId, esaurito: nuovo }),
    });
    if (res.ok) { toast.success(nuovo ? "Esaurito: torna disponibile da solo alle 5:00 di domani" : "Di nuovo disponibile"); caricaMenu(); }
    else toast.error("Operazione non riuscita");
  };

  const toggleGlobale = async (item: any) => {
    if (item.isAttivo && !confirm(`Vuoi disattivare "${item.nome}"? Non sarà più ordinabile in nessuna sede finché non lo riattivi.`)) return;
    const res = await fetch(`/api/menu/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAttivo: !item.isAttivo }),
    });
    if (res.ok) { toast.success(!item.isAttivo ? "Abilitato globalmente" : "Disabilitato globalmente"); caricaMenu(); }
    else toast.error("Operazione non riuscita");
  };

  // «Pomodoro, mozzarella, olive»: i nomi degli ingredienti scelti, come descrizione.
  const testoIngredienti = (ids: string[]) => ids
    .map((id) => ingredienti.find((i) => i.id === id)?.nome as string | undefined)
    .filter((n): n is string => !!n)
    .map((n, i) => (i === 0 ? n : n.charAt(0).toLowerCase() + n.slice(1)))
    .join(", ");

  const salva = async () => {
    if (!form.nome.trim() || !form.prezzoBase) return toast.error("Compila nome e prezzo");
    // Senza descrizione scritta, si usano i nomi degli ingredienti scelti.
    const descrizione = form.descrizione.trim() || testoIngredienti(form.ingredientiIds);
    setSalvando(true);
    const res = await fetch(editItem ? `/api/menu/${editItem.id}` : "/api/menu", {
      method: editItem ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: form.nome, descrizione, categoria: form.categoria,
        prezzoBase: parseFloat(form.prezzoBase), prezzoOnline: form.prezzoOnline.trim() === "" ? null : parseFloat(form.prezzoOnline),
        ingredientiIds: form.ingredientiIds, allergeniExtra: form.allergeniExtra, allergeniDaVerificare: !form.allergeniControllati,
      }),
    });
    setSalvando(false);
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      return toast.error(d?.error ?? "Non riesco a salvare il prodotto");
    }
    if (copiaDi && nascondiComune && sedeId) {
      const r = await fetch(`/api/menu/${copiaDi.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sedeId, disponibile: false }),
      });
      if (!r.ok) toast.error("La tua versione è salvata, ma quella comune è ancora attiva: disattivala a mano");
    }
    toast.success(editItem ? "Prodotto aggiornato" : "Prodotto aggiunto");
    setShowModal(false); setEditItem(null); setCopiaDi(null);
    caricaMenu();
  };

  const cambiaLista = (lista: string[], valore: string) => lista.includes(valore) ? lista.filter((x) => x !== valore) : [...lista, valore];

  const cambiaAllergene = (codice: string) => setForm((p) => ({ ...p, allergeniExtra: cambiaLista(p.allergeniExtra, codice) }));

  // Cambiando gli ingredienti la descrizione li segue (così il cliente non legge ingredienti che non ci sono più) e gli
  // allergeni tornano da ricontrollare. Una descrizione scritta a mano non viene toccata.
  const cambiaIngrediente = (id: string) => setForm((p) => {
    const ids = cambiaLista(p.ingredientiIds, id);
    let descrizione = p.descrizione;
    if (!descScritta) {
      if (copiaDi) {
        const originali: string[] = formDa(copiaDi).ingredientiIds;
        const uguali = ids.length === originali.length && ids.every((x) => originali.includes(x));
        descrizione = uguali ? copiaDi.descrizione ?? "" : testoIngredienti(ids);
      } else if (!descrizione || descrizione === testoIngredienti(p.ingredientiIds)) {
        descrizione = testoIngredienti(ids);
      }
    }
    return { ...p, ingredientiIds: ids, descrizione, allergeniControllati: false };
  });

  // Tasti per modificare (o copiare) un prodotto: il super admin tutti, la sede solo i suoi; dei comuni può fare la sua versione.
  const azioni = (item: any) => {
    const st: React.CSSProperties = { background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)", padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)", whiteSpace: "nowrap" };
    return (
      <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {(isSuperAdmin || mio(item)) && <button onClick={() => apri(item)} style={st}>Modifica</button>}
        {mio(item) && <button onClick={() => elimina(item)} style={{ ...st, color: "var(--danger)", borderColor: "var(--danger-border)" }}>Elimina</button>}
        {!isSuperAdmin && !item.sedeId && item.categoria !== "combo" && <button onClick={() => apri(null, item)} style={st}>Crea la nostra versione</button>}
      </span>
    );
  };

  const etichettaSede = (item: any) => item.sedeId ? (
    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", padding: "2px 8px", borderRadius: 20, background: "var(--accent-bg-2)", border: "1px solid var(--accent-border)", color: "var(--accent-ink)", whiteSpace: "nowrap" }}>
      {isSuperAdmin ? `Solo ${String(item.sede?.nome ?? "una sede").replace("Don Basilico ", "")}` : "Solo nostro"}
    </span>
  ) : null;

  return (
    <div className="animate-in">
      {isSuperAdmin && (
        <div style={{ marginBottom: 14 }}>
          <select value={sedeVista} onChange={(e) => setSedeVista(e.target.value)} style={{ ...fieldSt, background: "#fff", width: 260 }}>
            <option value="">Tutte le sedi (vista globale)</option>
            {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          {sedeVista && (
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
              Stai gestendo solo questa sede. «Attiva» / «Disattivata» è permanente (resta com'è finché non lo cambi); «Esaurito» dura fino alle 5:00 del giorno dopo e poi il prodotto torna disponibile da solo. Per disattivarlo in tutte le sedi usa "Attivo globale".
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {cats.map((c) => (
            <button key={c} onClick={() => setCatFiltro(c)} style={{
              padding: "8px 15px", borderRadius: 20, fontSize: 12.5, cursor: "pointer",
              border: `1px solid ${catFiltro === c ? "var(--text)" : "var(--border)"}`,
              background: catFiltro === c ? "var(--text)" : "#fff",
              color: catFiltro === c ? "#fff" : "var(--text-3)",
              fontFamily: "var(--font-ui)",
            }}>{c === "tutti" ? "Tutti" : CAT_LABEL[c] ?? c}</button>
          ))}
        </div>
        <button
          onClick={() => apri(null)}
          style={{ background: "var(--text)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)" }}
        >{isSuperAdmin ? "Nuova voce (tutte le sedi)" : "Aggiungi un prodotto nostro"}</button>
      </div>

      {!isSuperAdmin && (
        <div style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)", borderRadius: 9, padding: "10px 16px", marginBottom: 16, fontSize: 12.5, color: "var(--accent-ink)" }}>
          Modalità sede: per ogni prodotto puoi scegliere «Attiva» / «Disattivata» (permanente, finché non la cambi) ed «Esaurito» (nascosto fino alle 5:00 del giorno dopo, poi torna da solo). I prodotti comuni li modifica solo l'admin: puoi aggiungere i tuoi con «Aggiungi un prodotto nostro», o fare la tua versione di una pizza con «Crea la nostra versione». I tuoi si vedono solo nella tua pizzeria, in cassa e nell'app.
        </div>
      )}

      {/* Da telefono: una scheda per prodotto, con tutti i comandi visibili (la tabella resta solo su schermi larghi). */}
      <div className="menu-cards-mobile" style={{ display: "none" }}>
        {itemsFiltrati.map((item) => {
          const prezzo = item.prezzoEffettivo ?? parseFloat(item.prezzoBase);
          const chip = (attivo: boolean): React.CSSProperties => ({
            padding: "6px 13px", borderRadius: 20, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
            border: `1px solid ${attivo ? "var(--accent-border)" : "var(--danger-border)"}`,
            background: attivo ? "var(--accent-bg-2)" : "var(--danger-bg)",
            color: attivo ? "var(--accent-ink)" : "var(--danger)",
            fontFamily: "var(--font-ui)",
          });
          return (
            <div key={item.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", opacity: item.isAttivo ? 1 : 0.7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text)" }}>{item.nome} {etichettaSede(item)}</div>
                  <div style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 2 }}>{CAT_LABEL[item.categoria] ?? item.categoria}</div>
                </div>
                <div className="num" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", textAlign: "right" }}>
                  <div>cassa {euro(prezzo)}</div>
                  <div style={{ color: "var(--text-muted)", fontWeight: 500 }}>app {euro(prezzoApp(item))}</div>
                </div>
              </div>
              {item.descrizione && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>{item.descrizione}</div>}
              {item.bloccatoDaIngrediente && sedeId && (
                <div style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 8 }}>Non disponibile oggi: manca {item.bloccatoDaIngrediente}</div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                <button onClick={() => isSuperAdmin && toggleGlobale(item)} disabled={!isSuperAdmin} style={{ ...chip(item.isAttivo), cursor: isSuperAdmin ? "pointer" : "default" }}>
                  {item.isAttivo ? "Attivo" : "Disattivato"}
                </button>
                {sedeId && (
                  <button onClick={() => toggleInVendita(item)} style={{ ...chip(inVendita(item)), cursor: "pointer" }}>
                    {inVendita(item) ? "Attiva" : "Disattivata"}
                  </button>
                )}
                {sedeId && inVendita(item) && (
                  <button onClick={() => toggleEsaurito(item)} style={item.esauritoOggi
                    ? { ...chip(false), cursor: "pointer" }
                    : { background: "#fff", border: "1px solid var(--border)", color: "var(--text-3)", padding: "6px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)", whiteSpace: "nowrap" }}>
                    {item.esauritoOggi ? "Esaurito · torna domani" : "Segna esaurito"}
                  </button>
                )}
                <span style={{ marginLeft: "auto" }}>{azioni(item)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="menu-table-desktop" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)" }}>
              {["Prodotto", "Categoria", "Prezzo cassa", "Prezzo app", "Attivo globale", ...(sedeId ? ["Attiva in questa sede", "Esaurito oggi"] : []), ""].map((h, i) => (
                <th key={i} style={{ padding: "11px 14px", textAlign: "left", fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itemsFiltrati.map((item) => {
              const prezzo = item.prezzoEffettivo ?? parseFloat(item.prezzoBase);
              return (
                <tr key={item.id} style={{ borderTop: "1px solid var(--border-soft)", opacity: item.isAttivo ? 1 : 0.55 }}>
                  <td style={{ padding: "13px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text)" }}>{item.nome}</span>
                      {etichettaSede(item)}
                      {!item.isAttivo && (
                        <span
                          onClick={() => isSuperAdmin && toggleGlobale(item)}
                          title={isSuperAdmin ? "Tocca per riattivare" : undefined}
                          style={{
                            opacity: 1, fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase",
                            padding: "2px 8px", borderRadius: 20, background: "var(--danger)", color: "#fff", flexShrink: 0,
                            cursor: isSuperAdmin ? "pointer" : "default",
                          }}>Disattivato</span>
                      )}
                    </div>
                    {item.descrizione && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{item.descrizione}</div>}
                  </td>
                  <td style={{ padding: "13px 14px" }}>
                    <span style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>{CAT_LABEL[item.categoria] ?? item.categoria}</span>
                  </td>
                  <td className="num" style={{ padding: "13px 14px", fontSize: 13.5, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap" }}>{euro(prezzo)}</td>
                  <td className="num" style={{ padding: "13px 14px", fontSize: 13.5, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap" }}>{euro(prezzoApp(item))}</td>
                  <td style={{ padding: "13px 14px" }}>
                    <button
                      onClick={() => isSuperAdmin && toggleGlobale(item)}
                      disabled={!isSuperAdmin}
                      style={{
                        padding: "5px 13px", borderRadius: 20, fontSize: 11.5, fontWeight: 500, cursor: isSuperAdmin ? "pointer" : "default",
                        border: `1px solid ${item.isAttivo ? "var(--accent-border)" : "var(--danger-border)"}`,
                        background: item.isAttivo ? "var(--accent-bg-2)" : "var(--danger-bg)",
                        color: item.isAttivo ? "var(--accent-ink)" : "var(--danger)",
                        fontFamily: "var(--font-ui)", whiteSpace: "nowrap",
                      }}
                    >{item.isAttivo ? "Attivo" : "Disattivo"}</button>
                  </td>
                  {sedeId && (
                    <td style={{ padding: "13px 14px" }}>
                      <button onClick={() => toggleInVendita(item)} title="Permanente: resta così finché non lo cambi" style={{
                        padding: "5px 13px", borderRadius: 20, fontSize: 11.5, fontWeight: 500, cursor: "pointer",
                        border: `1px solid ${inVendita(item) ? "var(--accent-border)" : "var(--danger-border)"}`,
                        background: inVendita(item) ? "var(--accent-bg-2)" : "var(--danger-bg)",
                        color: inVendita(item) ? "var(--accent-ink)" : "var(--danger)",
                        fontFamily: "var(--font-ui)", whiteSpace: "nowrap",
                      }}>{inVendita(item) ? "Attiva" : "Disattivata"}</button>
                    </td>
                  )}
                  {sedeId && (
                    <td style={{ padding: "13px 14px" }}>
                      {inVendita(item) ? (
                        <button onClick={() => toggleEsaurito(item)} title="Nascosto ai clienti fino alle 5:00 del giorno dopo, poi torna da solo" style={{
                          padding: "5px 13px", borderRadius: 20, fontSize: 11.5, fontWeight: 500, cursor: "pointer",
                          border: `1px solid ${item.esauritoOggi ? "var(--danger-border)" : "var(--border)"}`,
                          background: item.esauritoOggi ? "var(--danger-bg)" : "#fff",
                          color: item.esauritoOggi ? "var(--danger)" : "var(--text-3)",
                          fontFamily: "var(--font-ui)", whiteSpace: "nowrap",
                        }}>{item.esauritoOggi ? "Esaurito · torna domani" : "Segna esaurito"}</button>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                      )}
                      {item.bloccatoDaIngrediente && (
                        <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>Manca: {item.bloccatoDaIngrediente}</div>
                      )}
                    </td>
                  )}
                  <td style={{ padding: "13px 14px", textAlign: "right" }}>{azioni(item)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="con-tastierino" style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 26, width: 520, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text)", marginBottom: 18 }}>
              {editItem ? "Modifica prodotto" : copiaDi ? `La nostra versione di ${copiaDi.nome}` : isSuperAdmin ? "Nuovo prodotto per tutte le sedi" : "Nuovo prodotto della nostra pizzeria"}
            </h2>
            {[
              { label: "Nome *", key: "nome", placeholder: "es. Margherita" },
              { label: "Descrizione", key: "descrizione", placeholder: "es. Pomodoro, mozzarella, basilico" },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={labelSt}>{f.label}</label>
                <input style={fieldSt} placeholder={f.placeholder} value={(form as any)[f.key]} onChange={(e) => { if (f.key === "descrizione") setDescScritta(true); setForm((p) => ({ ...p, [f.key]: e.target.value })); }} />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <div>
                <label style={labelSt}>Categoria *</label>
                <select style={fieldSt} value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}>
                  {["combo", "pizze_rosse", "pizze_bianche", "calzoni", "focacce", "menu_speciale", "fritti", "bevande", "dolci", "extra"].filter((c) => isSuperAdmin || c !== "combo").map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
              <div>
                <label style={labelSt}>Prezzo cassa (€) *</label>
                <input style={fieldSt} inputMode="decimal" placeholder="7.50" value={form.prezzoBase} onChange={(e) => setForm((p) => ({ ...p, prezzoBase: e.target.value.replace(",", ".").replace(/[^\d.]/g, "") }))} />
              </div>
              <div>
                <label style={labelSt}>Prezzo app (€)</label>
                <input style={fieldSt} inputMode="decimal" placeholder="uguale alla cassa" value={form.prezzoOnline} onChange={(e) => setForm((p) => ({ ...p, prezzoOnline: e.target.value.replace(",", ".").replace(/[^\d.]/g, "") }))} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 14 }}>Il prezzo app vale per l'app ordini e il menù pubblico. Se lo lasci vuoto, è uguale a quello di cassa.</div>
            {!["bevande", "combo"].includes(form.categoria) && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelSt}>Ingredienti {form.ingredientiIds.length > 0 && `· ${form.ingredientiIds.length} scelti`}</label>
                <input style={{ ...fieldSt, marginBottom: 8 }} placeholder="Cerca ingrediente…" value={cercaIng} onChange={(e) => setCercaIng(e.target.value)} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 150, overflowY: "auto" }}>
                  {ingredientiUsabili
                    .filter((i) => form.ingredientiIds.includes(i.id) || i.nome.toLowerCase().includes(cercaIng.toLowerCase()))
                    .sort((a, b) => Number(form.ingredientiIds.includes(b.id)) - Number(form.ingredientiIds.includes(a.id)))
                    .map((i) => {
                      const on = form.ingredientiIds.includes(i.id);
                      return (
                        <button key={i.id} type="button" onClick={() => cambiaIngrediente(i.id)} style={{ padding: "5px 11px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: "1px solid", fontFamily: "var(--font-ui)", background: on ? "var(--text)" : "var(--surface-muted)", color: on ? "#fff" : "var(--text-3)", borderColor: on ? "var(--text)" : "var(--border)" }}>{i.nome}</button>
                      );
                    })}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Allergeni {form.ingredientiIds.length > 0 ? "in più rispetto agli ingredienti" : "del prodotto"}</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ALLERGENI.map((a) => {
                  const on = form.allergeniExtra.includes(a.codice);
                  return (
                    <button key={a.codice} type="button" onClick={() => cambiaAllergene(a.codice)} style={{ padding: "5px 11px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: "1px solid", fontFamily: "var(--font-ui)", background: on ? "var(--text)" : "var(--surface-muted)", color: on ? "#fff" : "var(--text-3)", borderColor: on ? "var(--text)" : "var(--border)" }}>{a.etichetta}</button>
                  );
                })}
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>
                <input type="checkbox" checked={form.allergeniControllati} onChange={(e) => setForm((p) => ({ ...p, allergeniControllati: e.target.checked }))} />
                <span>Ho controllato gli allergeni sulle etichette. Se non è spuntato, l'app scrive al cliente di chiedere al personale.</span>
              </label>
            </div>

            {copiaDi && (
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 16, fontSize: 12.5, color: "var(--text-2)", cursor: "pointer" }}>
                <input type="checkbox" checked={nascondiComune} onChange={(e) => setNascondiComune(e.target.checked)} />
                <span>Nella nostra pizzeria nascondi la {copiaDi.nome} comune (si può riattivare quando si vuole).</span>
              </label>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)", padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5 }}>Annulla</button>
              <button onClick={salva} disabled={salvando} style={{ background: "var(--text)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
                {editItem ? "Salva" : "Aggiungi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
