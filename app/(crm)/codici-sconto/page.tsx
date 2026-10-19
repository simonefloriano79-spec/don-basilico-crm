"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const fieldSt: React.CSSProperties = {
  width: "100%", background: "var(--surface-muted)", border: "1px solid var(--border)",
  color: "var(--text)", padding: "9px 12px", borderRadius: 9, fontSize: 12.5, outline: "none", fontFamily: "var(--font-ui)", boxSizing: "border-box",
};
const labelSt: React.CSSProperties = {
  display: "block", fontSize: 10, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1.6,
};
const aiutoSt: React.CSSProperties = { fontSize: 11.5, color: "var(--text-muted)", marginTop: 5, lineHeight: 1.4 };
const btnChiaro: React.CSSProperties = {
  background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)",
  padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)",
};

type Stato = "attivo" | "disattivato" | "programmato" | "scaduto" | "esaurito";
interface Codice {
  id: string; codice: string; percentuale: number; descrizione: string | null; attivo: boolean;
  validoDal: string; validoAl: string; maxUsiPerCliente: number; maxUsiTotali: number | null;
  ordineMinimo: number; soloPrimoOrdine: boolean; usi: number; scontoTotale: number; stato: Stato;
}

const STATO: Record<Stato, { testo: string; colore: string; sfondo: string }> = {
  attivo:      { testo: "Attivo",       colore: "var(--accent-ink)", sfondo: "var(--accent-bg)" },
  programmato: { testo: "Programmato",  colore: "var(--stato-nuovo)", sfondo: "#4a6fa514" },
  scaduto:     { testo: "Scaduto",      colore: "var(--danger)", sfondo: "var(--danger-bg)" },
  esaurito:    { testo: "Esaurito",     colore: "var(--danger)", sfondo: "var(--danger-bg)" },
  disattivato: { testo: "Disattivato",  colore: "var(--text-3)", sfondo: "var(--surface-muted)" },
};

const euro = (n: number) => `€ ${n.toFixed(2).replace(".", ",")}`;
const dataIt = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "");
const numIt = (n: number) => String(n).replace(".", ",");

function validita(c: Codice): string {
  if (c.validoDal && c.validoAl) return `dal ${dataIt(c.validoDal)} al ${dataIt(c.validoAl)}`;
  if (c.validoDal) return `dal ${dataIt(c.validoDal)}`;
  if (c.validoAl) return `fino al ${dataIt(c.validoAl)}`;
  return "sempre";
}

const FORM_VUOTO = {
  codice: "", percentuale: "15", descrizione: "", validoDal: "", validoAl: "",
  maxUsiPerCliente: "1", maxUsiTotali: "", ordineMinimo: "", soloPrimoOrdine: false,
};

export default function CodiciScontoPage() {
  const [codici, setCodici] = useState<Codice[] | null>(null);
  const [errore, setErrore] = useState("");
  const [modale, setModale] = useState<null | { modifica: Codice | null }>(null);
  const [form, setForm] = useState(FORM_VUOTO);
  const [salvataggio, setSalvataggio] = useState(false);

  const carica = async () => {
    const res = await fetch("/api/codici-sconto");
    if (res.status === 403) { setErrore("Solo il super admin può gestire i codici sconto."); setCodici([]); return; }
    if (!res.ok) { setErrore("Non riesco a caricare i codici sconto. Controlla che il database sia aggiornato."); setCodici([]); return; }
    setErrore("");
    setCodici(await res.json());
  };
  useEffect(() => { carica(); }, []);

  const apriNuovo = () => { setForm(FORM_VUOTO); setModale({ modifica: null }); };
  const apriModifica = (c: Codice) => {
    setForm({
      codice: c.codice, percentuale: numIt(c.percentuale), descrizione: c.descrizione ?? "", validoDal: c.validoDal, validoAl: c.validoAl,
      maxUsiPerCliente: String(c.maxUsiPerCliente), maxUsiTotali: c.maxUsiTotali == null ? "" : String(c.maxUsiTotali),
      ordineMinimo: c.ordineMinimo ? numIt(c.ordineMinimo) : "", soloPrimoOrdine: c.soloPrimoOrdine,
    });
    setModale({ modifica: c });
  };

  const salva = async () => {
    if (!modale) return;
    const nuovo = !modale.modifica;
    if (nuovo && form.codice.trim().length < 3) return toast.error("Scrivi il codice (almeno 3 caratteri)");
    const pct = Number(form.percentuale.replace(",", "."));
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return toast.error("La percentuale deve essere tra 1 e 100");
    if (nuovo && pct > 30 && !confirm(`Lo sconto è del ${numIt(pct)}%: è molto alto. Vuoi crearlo davvero?`)) return;
    if (form.validoDal && form.validoAl && form.validoAl < form.validoDal) return toast.error("La data di fine è prima di quella di inizio");

    setSalvataggio(true);
    const corpo = { ...form, codice: form.codice.trim().toUpperCase() };
    const res = nuovo
      ? await fetch("/api/codici-sconto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) })
      : await fetch(`/api/codici-sconto/${modale.modifica!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    setSalvataggio(false);
    if (res.ok) { toast.success(nuovo ? "Codice creato" : "Codice aggiornato"); setModale(null); carica(); }
    else { const e = await res.json().catch(() => ({})); toast.error(e.error ?? "Errore"); }
  };

  const cambiaAttivo = async (c: Codice) => {
    const res = await fetch(`/api/codici-sconto/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attivo: !c.attivo }) });
    if (res.ok) { toast.success(c.attivo ? "Codice disattivato" : "Codice riattivato"); carica(); }
    else { const e = await res.json().catch(() => ({})); toast.error(e.error ?? "Errore"); }
  };

  const elimina = async (c: Codice) => {
    if (!confirm(`Eliminare il codice ${c.codice}? Non è mai stato usato.`)) return;
    const res = await fetch(`/api/codici-sconto/${c.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Codice eliminato"); carica(); }
    else { const e = await res.json().catch(() => ({})); toast.error(e.error ?? "Errore"); }
  };

  const attivi = (codici ?? []).filter((c) => c.stato === "attivo").length;
  const totaleSconti = (codici ?? []).reduce((a, c) => a + c.scontoTotale, 0);
  const modificaUsato = !!modale?.modifica && modale.modifica.usi > 0;

  return (
    <div className="animate-in" style={{ minWidth: 0, maxWidth: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {codici ? `${codici.length} codici · ${attivi} attivi · sconti dati finora ${euro(totaleSconti)}` : "Carico…"}
        </span>
        <button onClick={apriNuovo} style={{ background: "var(--text)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)" }}>Nuovo codice</button>
      </div>

      {errore && <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", color: "var(--danger)", padding: "12px 14px", borderRadius: 10, fontSize: 12.5, marginBottom: 14 }}>{errore}</div>}

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)" }}>
              {["Codice", "Sconto", "Validità", "Regole", "Utilizzi", "Stato", "Azioni"].map((h) => (
                <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(codici ?? []).map((c) => {
              const s = STATO[c.stato];
              return (
                <tr key={c.id} style={{ borderTop: "1px solid var(--border-soft)", opacity: c.stato === "attivo" || c.stato === "programmato" ? 1 : 0.6 }}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1.2, color: "var(--text)" }}>{c.codice}</div>
                    {c.descrizione && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{c.descrizione}</div>}
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>-{numIt(c.percentuale)}%</td>
                  <td style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--text-3)" }}>{validita(c)}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-3)", lineHeight: 1.55 }}>
                    <div>{c.maxUsiPerCliente === 1 ? "1 volta per cliente" : `${c.maxUsiPerCliente} volte per cliente`}</div>
                    {c.soloPrimoOrdine && <div>solo primo ordine dell'app</div>}
                    {c.ordineMinimo > 0 && <div>da {euro(c.ordineMinimo)} di prodotti</div>}
                    {c.maxUsiTotali != null && <div>massimo {c.maxUsiTotali} utilizzi</div>}
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--text-2)" }}>
                    <div><strong>{c.usi}</strong>{c.maxUsiTotali != null ? ` / ${c.maxUsiTotali}` : ""} {c.usi === 1 ? "ordine" : "ordini"}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>sconti dati {euro(c.scontoTotale)}</div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20, background: s.sfondo, color: s.colore, whiteSpace: "nowrap" }}>{s.testo}</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => apriModifica(c)} style={btnChiaro}>Modifica</button>
                      <button onClick={() => cambiaAttivo(c)} style={{
                        ...btnChiaro,
                        background: c.attivo ? "var(--danger-bg)" : "var(--accent-bg-2)",
                        border: `1px solid ${c.attivo ? "var(--danger-border)" : "var(--accent-border)"}`,
                        color: c.attivo ? "var(--danger)" : "var(--accent-ink)",
                      }}>{c.attivo ? "Disattiva" : "Riattiva"}</button>
                      {c.usi === 0 && <button onClick={() => elimina(c)} style={btnChiaro}>Elimina</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {codici && codici.length === 0 && !errore && (
              <tr><td colSpan={7} style={{ padding: "26px 14px", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>Nessun codice. Creane uno con «Nuovo codice».</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p style={{ ...aiutoSt, marginTop: 14, maxWidth: 760 }}>
        Il cliente scrive il codice nel riepilogo dell'ordine, nell'app. Lo sconto vale sui prodotti (la consegna non si sconta) e non si somma allo sconto fedeltà.
        Un ordine annullato o rifiutato libera il codice. Le date sono giorni interi, ora italiana: «fino al 31 gennaio» vale fino alle 23:59 di quel giorno.
      </p>

      {modale && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,24,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 12 }} onClick={() => setModale(null)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 26, width: 520, maxWidth: "100%", maxHeight: "92vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text)", marginBottom: 18 }}>{modale.modifica ? `Modifica ${modale.modifica.codice}` : "Nuovo codice sconto"}</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelSt}>Codice *</label>
                <input style={{ ...fieldSt, textTransform: "uppercase", letterSpacing: 1.2, opacity: modale.modifica ? 0.6 : 1 }} value={form.codice} disabled={!!modale.modifica} maxLength={30}
                  placeholder="es. NATALE10" onChange={(e) => setForm((p) => ({ ...p, codice: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") }))} />
                <div style={aiutoSt}>Lettere e numeri, senza spazi.</div>
              </div>
              <div>
                <label style={labelSt}>Sconto % *</label>
                <input style={{ ...fieldSt, opacity: modificaUsato ? 0.6 : 1 }} inputMode="decimal" value={form.percentuale} disabled={modificaUsato}
                  onChange={(e) => setForm((p) => ({ ...p, percentuale: e.target.value }))} />
                <div style={aiutoSt}>{modificaUsato ? "Già usato: per un'altra percentuale crea un nuovo codice." : "Sui prodotti, consegna esclusa."}</div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelSt}>Descrizione (solo per te)</label>
              <input style={fieldSt} value={form.descrizione} maxLength={200} placeholder="Es. Benvenuto nell'app, volantini ottobre" onChange={(e) => setForm((p) => ({ ...p, descrizione: e.target.value }))} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelSt}>Valido dal</label>
                <input style={fieldSt} type="date" value={form.validoDal} onChange={(e) => setForm((p) => ({ ...p, validoDal: e.target.value }))} />
              </div>
              <div>
                <label style={labelSt}>Valido fino al (compreso)</label>
                <input style={fieldSt} type="date" value={form.validoAl} onChange={(e) => setForm((p) => ({ ...p, validoAl: e.target.value }))} />
              </div>
            </div>
            <div style={{ ...aiutoSt, marginTop: -4, marginBottom: 14 }}>Lascia vuote le date per un codice senza scadenza.</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelSt}>Usi per cliente</label>
                <input style={fieldSt} inputMode="numeric" value={form.maxUsiPerCliente} onChange={(e) => setForm((p) => ({ ...p, maxUsiPerCliente: e.target.value.replace(/\D/g, "") }))} />
              </div>
              <div>
                <label style={labelSt}>Usi totali (max)</label>
                <input style={fieldSt} inputMode="numeric" value={form.maxUsiTotali} placeholder="nessun limite" onChange={(e) => setForm((p) => ({ ...p, maxUsiTotali: e.target.value.replace(/\D/g, "") }))} />
              </div>
              <div>
                <label style={labelSt}>Spesa minima €</label>
                <input style={fieldSt} inputMode="decimal" value={form.ordineMinimo} placeholder="nessuna" onChange={(e) => setForm((p) => ({ ...p, ordineMinimo: e.target.value }))} />
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12.5, color: "var(--text-2)", marginBottom: 20, cursor: "pointer", lineHeight: 1.4 }}>
              <input type="checkbox" checked={form.soloPrimoOrdine} onChange={(e) => setForm((p) => ({ ...p, soloPrimoOrdine: e.target.checked }))} style={{ marginTop: 2 }} />
              <span><strong>Solo per il primo ordine dell'app</strong><br /><span style={{ color: "var(--text-muted)" }}>Non vale per chi ha già fatto un ordine online (gli annullati non contano).</span></span>
            </label>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModale(null)} style={{ ...btnChiaro, padding: "9px 16px", borderRadius: 9 }}>Annulla</button>
              <button onClick={salva} disabled={salvataggio} style={{ background: "var(--text)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 9, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5 }}>
                {salvataggio ? "Salvo…" : modale.modifica ? "Salva modifiche" : "Crea codice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
